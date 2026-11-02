import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  RoadsideInterventionStatus,
  RsaBrokerDirection,
  RsaBrokerEventStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import { assertClientFleetWrite } from '../iam/client-access';
import { PrismaService } from '../prisma/prisma.service';
import { secretsEqual, unsealSecret } from './rsa-broker-crypto';
import {
  buildBrokerDispatchPayload,
  mapInboundEventToInterventionStatus,
} from './rsa-broker-payload';
export { hashBrokerSecretForStorage } from './rsa-broker-crypto';

export type RsaBrokerEventRecord = {
  id: string;
  supplierId: string;
  interventionId: string | null;
  missionId: string | null;
  direction: RsaBrokerDirection;
  eventType: string;
  status: RsaBrokerEventStatus;
  externalRef: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class RsaBrokerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toEvent(row: {
    id: string;
    supplierId: string;
    interventionId: string | null;
    missionId: string | null;
    direction: RsaBrokerDirection;
    eventType: string;
    status: RsaBrokerEventStatus;
    externalRef: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): RsaBrokerEventRecord {
    return {
      id: row.id,
      supplierId: row.supplierId,
      interventionId: row.interventionId,
      missionId: row.missionId,
      direction: row.direction,
      eventType: row.eventType,
      status: row.status,
      externalRef: row.externalRef,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listEvents(
    tenantSlug: string,
    params: {
      page: number;
      pageSize: number;
      supplierId?: string;
      interventionId?: string;
    },
    _access?: AccessContext,
  ): Promise<{ items: RsaBrokerEventRecord[]; total: number }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const where: Prisma.RsaBrokerEventWhereInput = { tenantId: tenant.id };
    if (params.supplierId) where.supplierId = params.supplierId;
    if (params.interventionId) where.interventionId = params.interventionId;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.rsaBrokerEvent.count({ where }),
      this.prisma.rsaBrokerEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return { items: rows.map((r) => this.toEvent(r)), total };
  }

  /**
   * Trimite dispatch către broker (sau dry-run dacă lipsește URL).
   */
  async dispatchIntervention(
    tenantSlug: string,
    interventionId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaBrokerEventRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Intervention not found');

    const intervention = await this.prisma.roadsideIntervention.findFirst({
      where: { id: interventionId, tenantId: tenant.id },
      include: {
        client: { select: { legalName: true } },
        vehicle: { select: { registrationNumber: true } },
        supplier: { select: { id: true, legalName: true } },
        towMission: true,
      },
    });
    if (!intervention) throw new NotFoundException('Intervention not found');
    if (access) assertClientFleetWrite(access, intervention.clientId);
    if (!intervention.supplierId || !intervention.supplier) {
      throw new BadRequestException('Intervention needs a roadside supplier');
    }
    if (intervention.status === RoadsideInterventionStatus.cancelled) {
      throw new BadRequestException('Cannot dispatch a cancelled intervention');
    }

    const profile = await this.prisma.rsaSupplierProfile.findUnique({
      where: { supplierId: intervention.supplierId },
    });
    if (!profile) throw new BadRequestException('RSA supplier profile missing');
    if (!profile.brokerOutboundEnabled) {
      throw new BadRequestException('Broker outbound is disabled on supplier profile');
    }

    const payload = buildBrokerDispatchPayload({
      tenantSlug,
      intervention: {
        id: intervention.id,
        displayNumber: intervention.displayNumber,
        kind: intervention.kind,
        status: intervention.status,
        locationText: intervention.locationText,
        entitlementStatus: intervention.entitlementStatus,
        requestedAt: intervention.requestedAt,
        notes: intervention.notes,
        clientId: intervention.clientId,
        clientLegalName: intervention.client.legalName,
        vehicleId: intervention.vehicleId,
        vehicleReg: intervention.vehicle?.registrationNumber ?? null,
      },
      supplier: {
        id: intervention.supplier.id,
        legalName: intervention.supplier.legalName,
      },
      mission: intervention.towMission
        ? {
            id: intervention.towMission.id,
            status: intervention.towMission.status,
            pickupLocationText: intervention.towMission.pickupLocationText,
            dropoffLocationText: intervention.towMission.dropoffLocationText,
            etaMinutes: intervention.towMission.etaMinutes,
          }
        : null,
      sla: {
        ackMinutes: profile.slaAckMinutes,
        arrivalUrbanMinutes: profile.slaArrivalUrbanMinutes,
        arrivalHighwayMinutes: profile.slaArrivalHighwayMinutes,
        is24x7: profile.is24x7,
      },
    });

    const baseUrl = profile.brokerApiBaseUrl?.trim().replace(/\/$/, '') ?? '';
    let status: RsaBrokerEventStatus = RsaBrokerEventStatus.dry_run;
    let responsePayload: Prisma.InputJsonValue | undefined;
    let errorMessage: string | null = null;
    let externalRef: string | null = null;

    if (!baseUrl) {
      status = RsaBrokerEventStatus.dry_run;
      responsePayload = { note: 'No brokerApiBaseUrl — payload logged only' };
    } else {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Tenant-Slug': tenantSlug,
          'X-RSA-Event': 'dispatch_request',
        };
        const apiKey = unsealSecret(profile.brokerApiKeySealed);
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        if (profile.brokerApiKeyLast4) {
          headers['X-RSA-Key-Hint'] = profile.brokerApiKeyLast4;
        }

        const res = await fetch(`${baseUrl}/v1/rsa/dispatch`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        const text = await res.text();
        let parsed: unknown = text;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          /* keep text */
        }
        responsePayload = { httpStatus: res.status, body: parsed } as Prisma.InputJsonValue;
        if (res.ok) {
          status = RsaBrokerEventStatus.accepted;
          if (parsed && typeof parsed === 'object' && parsed !== null) {
            const o = parsed as Record<string, unknown>;
            if (typeof o.externalRef === 'string') externalRef = o.externalRef;
            else if (typeof o.id === 'string') externalRef = o.id;
          }
        } else {
          status = RsaBrokerEventStatus.failed;
          errorMessage = `HTTP ${res.status}`;
        }
      } catch (e) {
        status = RsaBrokerEventStatus.failed;
        errorMessage = e instanceof Error ? e.message : String(e);
        responsePayload = { error: errorMessage };
      }
    }

    const row = await this.prisma.rsaBrokerEvent.create({
      data: {
        tenantId: tenant.id,
        supplierId: intervention.supplierId,
        profileId: profile.id,
        interventionId: intervention.id,
        missionId: intervention.towMission?.id ?? null,
        direction: RsaBrokerDirection.outbound,
        eventType: 'dispatch_request',
        status,
        externalRef,
        requestPayloadJson: payload as unknown as Prisma.InputJsonValue,
        responsePayloadJson: responsePayload,
        errorMessage,
      },
    });

    // Doar acceptarea broker promovează statusul — dry_run nu mută intervenția.
    if (status === RsaBrokerEventStatus.accepted) {
      if (
        intervention.status === RoadsideInterventionStatus.draft ||
        intervention.status === RoadsideInterventionStatus.requested
      ) {
        await this.prisma.roadsideIntervention.update({
          where: { id: intervention.id },
          data: {
            status: RoadsideInterventionStatus.dispatched,
            dispatchedAt: intervention.dispatchedAt ?? new Date(),
          },
        });
      }
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_broker.dispatch',
      entityType: 'rsa_broker_event',
      entityId: row.id,
      meta: { interventionId, status, externalRef },
    });

    return this.toEvent(row);
  }

  /**
   * Webhook inbound — autentificat cu secret pe profil (fără JWT).
   */
  async handleInboundWebhook(input: {
    tenantSlug: string;
    supplierId: string;
    secret: string;
    body: {
      eventType?: string;
      interventionId?: string;
      displayNumber?: string;
      externalRef?: string;
      etaMinutes?: number;
      notes?: string;
      missionStatus?: string;
    };
  }): Promise<RsaBrokerEventRecord> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: input.tenantSlug.trim() },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const profile = await this.prisma.rsaSupplierProfile.findFirst({
      where: { tenantId: tenant.id, supplierId: input.supplierId.trim() },
    });
    if (!profile || !profile.brokerInboundEnabled) {
      throw new ForbiddenException('Inbound broker disabled');
    }
    if (!secretsEqual(input.secret, profile.brokerInboundSecretHash)) {
      throw new UnauthorizedException('Invalid broker secret');
    }

    const eventType = (input.body.eventType ?? 'status_update').trim();
    if (!eventType) throw new BadRequestException('eventType required');

    let intervention =
      input.body.interventionId?.trim()
        ? await this.prisma.roadsideIntervention.findFirst({
            where: {
              id: input.body.interventionId.trim(),
              tenantId: tenant.id,
              supplierId: profile.supplierId,
            },
            include: { towMission: true },
          })
        : null;

    if (!intervention && input.body.displayNumber?.trim()) {
      intervention = await this.prisma.roadsideIntervention.findFirst({
        where: {
          tenantId: tenant.id,
          displayNumber: input.body.displayNumber.trim(),
          supplierId: profile.supplierId,
        },
        include: { towMission: true },
      });
    }

    if (!intervention && input.body.externalRef?.trim()) {
      const prev = await this.prisma.rsaBrokerEvent.findFirst({
        where: {
          tenantId: tenant.id,
          supplierId: profile.supplierId,
          externalRef: input.body.externalRef.trim(),
        },
        orderBy: { createdAt: 'desc' },
      });
      if (prev?.interventionId) {
        intervention = await this.prisma.roadsideIntervention.findFirst({
          where: { id: prev.interventionId, tenantId: tenant.id },
          include: { towMission: true },
        });
      }
    }

    const nextStatus = mapInboundEventToInterventionStatus(eventType);
    if (intervention && nextStatus) {
      const data: Prisma.RoadsideInterventionUncheckedUpdateInput = {
        status: nextStatus,
      };
      if (nextStatus === RoadsideInterventionStatus.dispatched) {
        data.dispatchedAt = intervention.dispatchedAt ?? new Date();
      }
      if (nextStatus === RoadsideInterventionStatus.on_site) {
        data.onSiteAt = intervention.onSiteAt ?? new Date();
      }
      if (nextStatus === RoadsideInterventionStatus.completed) {
        data.completedAt = intervention.completedAt ?? new Date();
      }
      await this.prisma.roadsideIntervention.update({
        where: { id: intervention.id },
        data,
      });

      if (
        intervention.towMission &&
        input.body.etaMinutes != null &&
        Number.isFinite(input.body.etaMinutes)
      ) {
        await this.prisma.rsaTowMission.update({
          where: { id: intervention.towMission.id },
          data: { etaMinutes: Math.round(input.body.etaMinutes) },
        });
      }
    }

    const row = await this.prisma.rsaBrokerEvent.create({
      data: {
        tenantId: tenant.id,
        supplierId: profile.supplierId,
        profileId: profile.id,
        interventionId: intervention?.id ?? null,
        missionId: intervention?.towMission?.id ?? null,
        direction: RsaBrokerDirection.inbound,
        eventType,
        status: RsaBrokerEventStatus.received,
        externalRef: input.body.externalRef?.trim() || null,
        requestPayloadJson: input.body as unknown as Prisma.InputJsonValue,
        responsePayloadJson: {
          appliedInterventionStatus: nextStatus,
          matched: Boolean(intervention),
        },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      action: 'rsa_broker.inbound',
      entityType: 'rsa_broker_event',
      entityId: row.id,
      meta: {
        eventType,
        interventionId: intervention?.id ?? null,
        nextStatus,
      },
    });

    return this.toEvent(row);
  }
}
