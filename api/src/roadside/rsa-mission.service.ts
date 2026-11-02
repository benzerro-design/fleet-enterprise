import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  Prisma,
  RoadsideInterventionStatus,
  RsaHandoverKind,
  RsaHandoverMediaKind,
  RsaHandoverProtocolStatus,
  RsaHandoverSignerRole,
  RsaMissionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertClientAccess,
  assertClientFleetWrite,
  isDriverOnlyClientUser,
  isTenantWideAccess,
} from '../iam/client-access';
import {
  assertPartnerSupplierId,
  assertPartnerWrite,
  isPartnerUser,
} from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';
import { buildHandoverPdf } from './rsa-handover-pdf';
import {
  canTransitionMission,
  requiresSignedProtocol,
  timestampFieldForStatus,
} from './rsa-mission-transitions';
import {
  computeRsaSettlement,
  parseRateCardSnapshot,
  RSA_COST_CATEGORY,
  type RsaSettlementBreakdown,
  type RsaSettlementRateCard,
} from './rsa-settlement';

const MIN_SIGNATURES = 2;
const MIN_MEDIA_FOR_SIGN = 1;

const DEFAULT_CHECKLIST: Record<string, boolean> = {
  papers_present: false,
  keys_present: false,
  spare_wheel: false,
  valuables_noted: false,
  damage_photographed: false,
};

function parseSettlementBreakdown(value: Prisma.JsonValue | null | undefined): RsaSettlementBreakdown | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.amountCents !== 'number' || typeof o.mode !== 'string') return null;
  return value as unknown as RsaSettlementBreakdown;
}

export type RsaMissionRecord = {
  id: string;
  interventionId: string;
  interventionDisplayNumber: string | null;
  clientId: string;
  clientLegalName: string;
  vehicleId: string | null;
  vehicleReg: string | null;
  supplierId: string;
  supplierLegalName: string;
  driverUserId: string | null;
  driverDisplayName: string | null;
  platformPlate: string | null;
  status: RsaMissionStatus;
  pickupLocationText: string | null;
  dropoffLocationText: string | null;
  etaMinutes: number | null;
  assignedAt: string;
  enRouteAt: string | null;
  onSceneAt: string | null;
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  distanceKm: number | null;
  settlementCostEntryId: string | null;
  settledAt: string | null;
  settlementAmountCents: number | null;
  settlementBreakdown: RsaSettlementBreakdown | null;
  protocols: RsaProtocolSummary[];
  createdAt: string;
  updatedAt: string;
};

export type RsaSettlementResult = {
  mission: RsaMissionRecord;
  costEntryId: string;
  amountCents: number;
  breakdown: RsaSettlementBreakdown;
  idempotent: boolean;
};

type SettlementContext = {
  tenantId: string;
  supplierLegalName: string;
  rateCard: RsaSettlementRateCard;
  plan: { includedTowKm: number | null; overagePerKmCents: number | null } | null;
  mission: {
    id: string;
    supplierId: string;
    interventionId: string;
    status: RsaMissionStatus;
    distanceKm: number | null;
    settlementCostEntryId: string | null;
    settlementAmountCents: number | null;
    protocols: Array<{ kind: RsaHandoverKind; status: RsaHandoverProtocolStatus }>;
    intervention: { clientId: string; vehicleId?: string | null };
  };
  intervention: {
    id: string;
    displayNumber: string | null;
    clientId: string;
    vehicleId: string | null;
    kind: string;
    entitlementStatus: string;
    enrollmentId: string | null;
    entitlementIncludedTowKm: number | null;
    entitlementOveragePerKmCents: number | null;
  };
};

export type RsaProtocolSummary = {
  id: string;
  kind: RsaHandoverKind;
  status: RsaHandoverProtocolStatus;
  signatureCount: number;
  mediaCount: number;
  signedAt: string | null;
};

export type RsaProtocolRecord = {
  id: string;
  missionId: string;
  kind: RsaHandoverKind;
  status: RsaHandoverProtocolStatus;
  locationText: string | null;
  odometerKm: number | null;
  fuelLevelPct: number | null;
  damageNotes: string | null;
  inventoryNotes: string | null;
  checklist: Record<string, boolean>;
  counterpartyName: string | null;
  counterpartyRoleNote: string | null;
  signedAt: string | null;
  signatures: Array<{
    id: string;
    role: RsaHandoverSignerRole;
    displayName: string;
    signedAt: string;
    signaturePngUrl: string;
  }>;
  media: Array<{
    id: string;
    kind: RsaHandoverMediaKind;
    fileUrl: string;
    fileName: string | null;
    caption: string | null;
    capturedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

type MissionRow = Prisma.RsaTowMissionGetPayload<{
  include: {
    supplier: { select: { legalName: true } };
    intervention: {
      select: {
        displayNumber: true;
        clientId: true;
        vehicleId: true;
        client: { select: { legalName: true } };
        vehicle: { select: { registrationNumber: true } };
      };
    };
    protocols: {
      include: {
        _count: { select: { signatures: true; media: true } };
      };
    };
  };
}>;

@Injectable()
export class RsaMissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toMission(row: MissionRow): RsaMissionRecord {
    return {
      id: row.id,
      interventionId: row.interventionId,
      interventionDisplayNumber: row.intervention.displayNumber,
      clientId: row.intervention.clientId,
      clientLegalName: row.intervention.client.legalName,
      vehicleId: row.intervention.vehicleId,
      vehicleReg: row.intervention.vehicle?.registrationNumber ?? null,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier.legalName,
      driverUserId: row.driverUserId,
      driverDisplayName: row.driverDisplayName,
      platformPlate: row.platformPlate,
      status: row.status,
      pickupLocationText: row.pickupLocationText,
      dropoffLocationText: row.dropoffLocationText,
      etaMinutes: row.etaMinutes,
      assignedAt: row.assignedAt.toISOString(),
      enRouteAt: row.enRouteAt?.toISOString() ?? null,
      onSceneAt: row.onSceneAt?.toISOString() ?? null,
      pickedUpAt: row.pickedUpAt?.toISOString() ?? null,
      inTransitAt: row.inTransitAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancelReason: row.cancelReason,
      notes: row.notes,
      distanceKm: row.distanceKm,
      settlementCostEntryId: row.settlementCostEntryId,
      settledAt: row.settledAt?.toISOString() ?? null,
      settlementAmountCents: row.settlementAmountCents,
      settlementBreakdown: parseSettlementBreakdown(row.settlementBreakdownJson),
      protocols: row.protocols.map((p) => ({
        id: p.id,
        kind: p.kind,
        status: p.status,
        signatureCount: p._count.signatures,
        mediaCount: p._count.media,
        signedAt: p.signedAt?.toISOString() ?? null,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private missionInclude() {
    return {
      supplier: { select: { legalName: true } },
      intervention: {
        select: {
          displayNumber: true,
          clientId: true,
          vehicleId: true,
          client: { select: { legalName: true } },
          vehicle: { select: { registrationNumber: true } },
        },
      },
      protocols: {
        include: { _count: { select: { signatures: true, media: true } } },
      },
    } as const;
  }

  private assertMissionRead(
    access: AccessContext | undefined,
    row: {
      supplierId: string;
      intervention: { clientId: string; vehicleId?: string | null };
    },
  ) {
    if (!access) return;
    if (isTenantWideAccess(access)) return;
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, row.supplierId);
      return;
    }
    assertClientAccess(access, row.intervention.clientId);
    if (isDriverOnlyClientUser(access)) {
      const ids = access.assignedVehicleIds ?? [];
      if (!row.intervention.vehicleId || !ids.includes(row.intervention.vehicleId)) {
        throw new ForbiddenException('Vehicle access denied');
      }
    }
  }

  private assertMissionWrite(
    access: AccessContext | undefined,
    row: { supplierId: string; intervention: { clientId: string } },
  ) {
    if (!access) return;
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, row.supplierId);
      assertPartnerWrite(access);
      return;
    }
    assertClientFleetWrite(access, row.intervention.clientId);
  }

  private asChecklist(value: Prisma.JsonValue): Record<string, boolean> {
    const out = { ...DEFAULT_CHECKLIST };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  private toProtocol(
    row: Prisma.RsaHandoverProtocolGetPayload<{
      include: { signatures: true; media: true };
    }>,
  ): RsaProtocolRecord {
    return {
      id: row.id,
      missionId: row.missionId,
      kind: row.kind,
      status: row.status,
      locationText: row.locationText,
      odometerKm: row.odometerKm,
      fuelLevelPct: row.fuelLevelPct,
      damageNotes: row.damageNotes,
      inventoryNotes: row.inventoryNotes,
      checklist: this.asChecklist(row.checklistJson),
      counterpartyName: row.counterpartyName,
      counterpartyRoleNote: row.counterpartyRoleNote,
      signedAt: row.signedAt?.toISOString() ?? null,
      signatures: row.signatures.map((s) => ({
        id: s.id,
        role: s.role,
        displayName: s.displayName,
        signedAt: s.signedAt.toISOString(),
        signaturePngUrl: s.signaturePngUrl,
      })),
      media: row.media.map((m) => ({
        id: m.id,
        kind: m.kind,
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        caption: m.caption,
        capturedAt: m.capturedAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listMissions(
    tenantSlug: string,
    params: {
      page: number;
      pageSize: number;
      status?: RsaMissionStatus;
      supplierId?: string;
      interventionId?: string;
    },
    access?: AccessContext,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }

    const parts: Prisma.RsaTowMissionWhereInput[] = [{ tenantId: tenant.id }];
    if (access && !isTenantWideAccess(access)) {
      if (isPartnerUser(access)) {
        const ids = access.allowedSupplierIds;
        if (ids.length === 0) {
          return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
        }
        parts.push({ supplierId: { in: ids } });
      } else if (access.allowedClientIds.length === 0) {
        return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
      } else if (isDriverOnlyClientUser(access)) {
        const ids = access.assignedVehicleIds ?? [];
        if (ids.length === 0) {
          return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
        }
        parts.push({ intervention: { vehicleId: { in: ids } } });
      } else {
        parts.push({ intervention: { clientId: { in: access.allowedClientIds } } });
      }
    }
    if (params.status) parts.push({ status: params.status });
    if (params.supplierId) {
      if (access && isPartnerUser(access)) {
        assertPartnerSupplierId(access, params.supplierId);
      }
      parts.push({ supplierId: params.supplierId });
    }
    if (params.interventionId) parts.push({ interventionId: params.interventionId });

    const pageSize = Math.min(Math.max(1, params.pageSize), 100);
    const page = Math.max(1, params.page);
    const where: Prisma.RsaTowMissionWhereInput = { AND: parts };

    const [total, rows] = await Promise.all([
      this.prisma.rsaTowMission.count({ where }),
      this.prisma.rsaTowMission.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.missionInclude(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toMission(r)),
      total,
      page,
      pageSize,
    };
  }

  async getMission(
    tenantSlug: string,
    id: string,
    access?: AccessContext,
  ): Promise<RsaMissionRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Mission not found');
    const row = await this.prisma.rsaTowMission.findFirst({
      where: { id, tenantId: tenant.id },
      include: this.missionInclude(),
    });
    if (!row) throw new NotFoundException('Mission not found');
    this.assertMissionRead(access, row);
    return this.toMission(row);
  }

  async createMission(
    tenantSlug: string,
    input: {
      interventionId: string;
      driverUserId?: string | null;
      driverDisplayName?: string | null;
      platformPlate?: string | null;
      pickupLocationText?: string | null;
      dropoffLocationText?: string | null;
      etaMinutes?: number | null;
      notes?: string | null;
    },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaMissionRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const intervention = await this.prisma.roadsideIntervention.findFirst({
      where: { id: input.interventionId, tenantId: tenant.id },
    });
    if (!intervention) throw new NotFoundException('Intervention not found');
    if (!intervention.supplierId) {
      throw new BadRequestException('Intervention must have a roadside supplier before mission');
    }

    this.assertMissionWrite(access, {
      supplierId: intervention.supplierId,
      intervention: { clientId: intervention.clientId },
    });

    const existing = await this.prisma.rsaTowMission.findUnique({
      where: { interventionId: intervention.id },
    });
    if (existing) throw new BadRequestException('Mission already exists for this intervention');

    let driverDisplayName = input.driverDisplayName?.trim() || null;
    if (input.driverUserId && !driverDisplayName) {
      const u = await this.prisma.user.findUnique({
        where: { id: input.driverUserId },
        select: { displayName: true, email: true },
      });
      driverDisplayName = u?.displayName || u?.email || null;
    }

    const profile = await this.prisma.rsaSupplierProfile.findUnique({
      where: { supplierId: intervention.supplierId },
      select: {
        baseCalloutOutPlanCents: true,
        towHookOutPlanCents: true,
        towPerKmOutPlanCents: true,
        winchSurchargeCents: true,
        nightWeekendMultiplierPct: true,
      },
    });
    const rateCardSnapshot: RsaSettlementRateCard = {
      baseCalloutOutPlanCents: profile?.baseCalloutOutPlanCents ?? 0,
      towHookOutPlanCents: profile?.towHookOutPlanCents ?? 0,
      towPerKmOutPlanCents: profile?.towPerKmOutPlanCents ?? 0,
      winchSurchargeCents: profile?.winchSurchargeCents ?? 0,
      nightWeekendMultiplierPct: profile?.nightWeekendMultiplierPct ?? 0,
    };

    const row = await this.prisma.$transaction(async (tx) => {
      const mission = await tx.rsaTowMission.create({
        data: {
          tenantId: tenant.id,
          interventionId: intervention.id,
          supplierId: intervention.supplierId!,
          driverUserId: input.driverUserId?.trim() || null,
          driverDisplayName,
          platformPlate: input.platformPlate?.trim() || null,
          pickupLocationText:
            input.pickupLocationText?.trim() || intervention.locationText || null,
          dropoffLocationText: input.dropoffLocationText?.trim() || null,
          etaMinutes: input.etaMinutes ?? null,
          notes: input.notes?.trim() || null,
          status: RsaMissionStatus.assigned,
          rateCardSnapshotJson: rateCardSnapshot,
        },
        include: this.missionInclude(),
      });

      if (
        intervention.status === RoadsideInterventionStatus.draft ||
        intervention.status === RoadsideInterventionStatus.requested
      ) {
        await tx.roadsideIntervention.update({
          where: { id: intervention.id },
          data: {
            status: RoadsideInterventionStatus.dispatched,
            dispatchedAt: intervention.dispatchedAt ?? new Date(),
          },
        });
      }

      return mission;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_tow_mission.create',
      entityType: 'rsa_tow_mission',
      entityId: row.id,
      meta: { interventionId: intervention.id },
    });

    return this.toMission(row);
  }

  async patchMission(
    tenantSlug: string,
    id: string,
    input: {
      status?: RsaMissionStatus;
      driverUserId?: string | null;
      driverDisplayName?: string | null;
      platformPlate?: string | null;
      pickupLocationText?: string | null;
      dropoffLocationText?: string | null;
      etaMinutes?: number | null;
      notes?: string | null;
      cancelReason?: string | null;
      distanceKm?: number | null;
    },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaMissionRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Mission not found');

    const existing = await this.prisma.rsaTowMission.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        intervention: { select: { clientId: true, id: true, status: true } },
        protocols: { select: { kind: true, status: true } },
      },
    });
    if (!existing) throw new NotFoundException('Mission not found');
    this.assertMissionWrite(access, existing);

    const data: Prisma.RsaTowMissionUncheckedUpdateInput = {};
    if (input.driverUserId !== undefined) data.driverUserId = input.driverUserId;
    if (input.driverDisplayName !== undefined) {
      data.driverDisplayName = input.driverDisplayName?.trim() || null;
    }
    if (input.platformPlate !== undefined) {
      data.platformPlate = input.platformPlate?.trim() || null;
    }
    if (input.pickupLocationText !== undefined) {
      data.pickupLocationText = input.pickupLocationText?.trim() || null;
    }
    if (input.dropoffLocationText !== undefined) {
      data.dropoffLocationText = input.dropoffLocationText?.trim() || null;
    }
    if (input.etaMinutes !== undefined) data.etaMinutes = input.etaMinutes;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.cancelReason !== undefined) {
      data.cancelReason = input.cancelReason?.trim() || null;
    }
    if (input.distanceKm !== undefined) {
      if (existing.settlementCostEntryId) {
        throw new BadRequestException('Cannot change distanceKm after settlement');
      }
      if (input.distanceKm === null) {
        data.distanceKm = null;
      } else if (
        !Number.isFinite(input.distanceKm) ||
        input.distanceKm < 0 ||
        Math.round(input.distanceKm) !== input.distanceKm
      ) {
        throw new BadRequestException('distanceKm must be a non-negative integer');
      } else {
        data.distanceKm = input.distanceKm;
      }
    }

    const statusChanging =
      input.status !== undefined && input.status !== existing.status;
    if (statusChanging && input.status !== undefined) {
      if (!canTransitionMission(existing.status, input.status)) {
        throw new BadRequestException(
          `Invalid mission transition ${existing.status} → ${input.status}`,
        );
      }
      const need = requiresSignedProtocol(input.status);
      if (need) {
        const proto = existing.protocols.find((p) => p.kind === need);
        if (!proto || proto.status !== RsaHandoverProtocolStatus.signed) {
          throw new BadRequestException(
            `Cannot move to ${input.status}: signed ${need} protocol required`,
          );
        }
      }
      data.status = input.status;
      const tsField = timestampFieldForStatus(input.status);
      if (tsField) data[tsField] = new Date();
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const mission = await tx.rsaTowMission.update({
        where: { id },
        data,
        include: this.missionInclude(),
      });

      if (statusChanging && input.status) {
        const intervention = await tx.roadsideIntervention.findUnique({
          where: { id: existing.interventionId },
          select: { status: true },
        });
        // Nu resuscita o intervenție deja anulată.
        if (intervention?.status !== RoadsideInterventionStatus.cancelled) {
          if (input.status === RsaMissionStatus.en_route) {
            await tx.roadsideIntervention.update({
              where: { id: existing.interventionId },
              data: {
                status: RoadsideInterventionStatus.dispatched,
                dispatchedAt: new Date(),
              },
            });
          } else if (input.status === RsaMissionStatus.on_scene) {
            await tx.roadsideIntervention.update({
              where: { id: existing.interventionId },
              data: {
                status: RoadsideInterventionStatus.on_site,
                onSiteAt: new Date(),
              },
            });
          } else if (
            input.status === RsaMissionStatus.delivered ||
            input.status === RsaMissionStatus.closed
          ) {
            await tx.roadsideIntervention.update({
              where: { id: existing.interventionId },
              data: {
                status: RoadsideInterventionStatus.completed,
                completedAt: new Date(),
              },
            });
          } else if (input.status === RsaMissionStatus.cancelled) {
            await tx.roadsideIntervention.update({
              where: { id: existing.interventionId },
              data: { status: RoadsideInterventionStatus.cancelled },
            });
          }
        }
      }

      return mission;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_tow_mission.patch',
      entityType: 'rsa_tow_mission',
      entityId: id,
      meta: input,
    });

    return this.toMission(row);
  }

  /**
   * Preview decont (fără scriere). Folosește snapshot entitlement de pe intervenție.
   */
  async previewSettlement(
    tenantSlug: string,
    id: string,
    input: {
      distanceKm?: number | null;
      applyNightWeekend?: boolean;
      applyWinch?: boolean;
    } = {},
    access?: AccessContext,
  ): Promise<{
    missionId: string;
    distanceKm: number;
    breakdown: RsaSettlementBreakdown;
    alreadySettled: boolean;
    settlementCostEntryId: string | null;
  }> {
    const ctx = await this.loadSettlementContext(tenantSlug, id, access, 'read');
    const distanceKm = this.resolveDistanceKm(ctx.mission.distanceKm, input.distanceKm);
    const breakdown = this.buildBreakdown(ctx, distanceKm, input);
    return {
      missionId: ctx.mission.id,
      distanceKm,
      breakdown,
      alreadySettled: Boolean(ctx.mission.settlementCostEntryId),
      settlementCostEntryId: ctx.mission.settlementCostEntryId,
    };
  }

  /**
   * Creează CostEntry din entitlement snapshot + rate card + km.
   * Idempotent: al doilea call returnează același costEntryId.
   */
  async settleMission(
    tenantSlug: string,
    id: string,
    input: {
      distanceKm?: number | null;
      applyNightWeekend?: boolean;
      applyWinch?: boolean;
    } = {},
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaSettlementResult> {
    const ctx = await this.loadSettlementContext(tenantSlug, id, access, 'write');

    if (ctx.mission.settlementCostEntryId && ctx.mission.settlementAmountCents != null) {
      const mission = await this.prisma.rsaTowMission.findFirstOrThrow({
        where: { id: ctx.mission.id },
        include: this.missionInclude(),
      });
      const breakdown =
        parseSettlementBreakdown(mission.settlementBreakdownJson) ??
        this.buildBreakdown(ctx, mission.distanceKm ?? 0, input);
      return {
        mission: this.toMission(mission),
        costEntryId: ctx.mission.settlementCostEntryId,
        amountCents: ctx.mission.settlementAmountCents,
        breakdown,
        idempotent: true,
      };
    }

    if (
      ctx.mission.status !== RsaMissionStatus.delivered &&
      ctx.mission.status !== RsaMissionStatus.closed
    ) {
      throw new BadRequestException('Settle requires mission status delivered or closed');
    }

    const dropoff = ctx.mission.protocols.find((p) => p.kind === RsaHandoverKind.dropoff);
    if (!dropoff || dropoff.status !== RsaHandoverProtocolStatus.signed) {
      throw new BadRequestException('Settle requires signed dropoff protocol');
    }

    if (!ctx.intervention.vehicleId) {
      throw new BadRequestException('Intervention has no vehicleId — cannot create CostEntry');
    }

    const distanceKm = this.resolveDistanceKm(ctx.mission.distanceKm, input.distanceKm);
    const breakdown = this.buildBreakdown(ctx, distanceKm, input);
    const supplierName = ctx.supplierLegalName;

    const { row, idempotent, usedBreakdown } = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent settles on the same mission (avoid orphan CostEntry).
      await tx.$executeRaw`SELECT id FROM "RsaTowMission" WHERE id = ${ctx.mission.id} FOR UPDATE`;

      const fresh = await tx.rsaTowMission.findUnique({
        where: { id: ctx.mission.id },
        select: {
          settlementCostEntryId: true,
          settlementAmountCents: true,
          settlementBreakdownJson: true,
          rateCardSnapshotJson: true,
          status: true,
        },
      });
      if (fresh?.settlementCostEntryId && fresh.settlementAmountCents != null) {
        const mission = await tx.rsaTowMission.findFirstOrThrow({
          where: { id: ctx.mission.id },
          include: this.missionInclude(),
        });
        return {
          row: mission,
          idempotent: true,
          usedBreakdown:
            parseSettlementBreakdown(fresh.settlementBreakdownJson) ?? breakdown,
        };
      }

      // Îngheață rate card sub lock dacă lipsea (legacy).
      if (!parseRateCardSnapshot(fresh?.rateCardSnapshotJson)) {
        await tx.rsaTowMission.update({
          where: { id: ctx.mission.id },
          data: { rateCardSnapshotJson: ctx.rateCard },
        });
      }

      const cost = await tx.costEntry.create({
        data: {
          tenantId: ctx.tenantId,
          vehicleId: ctx.intervention.vehicleId!,
          category: RSA_COST_CATEGORY,
          amountCents: breakdown.amountCents,
          supplierId: ctx.mission.supplierId,
          provider: supplierName,
          notes: [
            `RSA settle ${ctx.intervention.displayNumber ?? ctx.mission.interventionId}`,
            `mission=${ctx.mission.id}`,
            `entitlement=${breakdown.entitlementStatus}`,
            `mode=${breakdown.mode}`,
            `km=${distanceKm}`,
          ].join(' | '),
          incurredOn: new Date(),
        },
      });

      const statusPatch: Prisma.RsaTowMissionUncheckedUpdateInput = {
        distanceKm,
        settlementCostEntryId: cost.id,
        settledAt: new Date(),
        settlementAmountCents: breakdown.amountCents,
        settlementBreakdownJson: breakdown as unknown as Prisma.InputJsonValue,
        rateCardSnapshotJson: ctx.rateCard,
      };
      if (fresh?.status === RsaMissionStatus.delivered) {
        statusPatch.status = RsaMissionStatus.closed;
        statusPatch.closedAt = new Date();
      }

      const mission = await tx.rsaTowMission.update({
        where: { id: ctx.mission.id },
        data: statusPatch,
        include: this.missionInclude(),
      });
      return { row: mission, idempotent: false, usedBreakdown: breakdown };
    });

    await this.audit.log({
      tenantId: ctx.tenantId,
      actorUserId,
      action: 'rsa_tow_mission.settle',
      entityType: 'rsa_tow_mission',
      entityId: id,
      meta: {
        costEntryId: row.settlementCostEntryId,
        amountCents: usedBreakdown.amountCents,
        distanceKm: row.distanceKm,
        entitlementStatus: usedBreakdown.entitlementStatus,
        mode: usedBreakdown.mode,
        idempotent,
      },
    });

    return {
      mission: this.toMission(row),
      costEntryId: row.settlementCostEntryId!,
      amountCents: usedBreakdown.amountCents,
      breakdown: usedBreakdown,
      idempotent,
    };
  }

  private resolveDistanceKm(
    stored: number | null,
    override?: number | null,
  ): number {
    const raw = override !== undefined && override !== null ? override : stored;
    if (raw === null || raw === undefined) {
      throw new BadRequestException('distanceKm is required for settlement');
    }
    if (!Number.isFinite(raw) || raw < 0 || Math.round(raw) !== raw) {
      throw new BadRequestException('distanceKm must be a non-negative integer');
    }
    return raw;
  }

  private buildBreakdown(
    ctx: SettlementContext,
    distanceKm: number,
    input: { applyNightWeekend?: boolean; applyWinch?: boolean },
  ): RsaSettlementBreakdown {
    try {
      return computeRsaSettlement({
        entitlementStatus: ctx.intervention.entitlementStatus,
        kind: ctx.intervention.kind,
        distanceKm,
        rateCard: ctx.rateCard,
        plan: ctx.plan,
        applyNightWeekend: input.applyNightWeekend,
        applyWinch: input.applyWinch,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid settlement input');
    }
  }

  private async loadSettlementContext(
    tenantSlug: string,
    id: string,
    access: AccessContext | undefined,
    mode: 'read' | 'write',
  ): Promise<SettlementContext> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Mission not found');

    const mission = await this.prisma.rsaTowMission.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        supplier: { select: { legalName: true } },
        protocols: { select: { kind: true, status: true } },
        intervention: {
          select: {
            id: true,
            displayNumber: true,
            clientId: true,
            vehicleId: true,
            kind: true,
            entitlementStatus: true,
            enrollmentId: true,
            entitlementIncludedTowKm: true,
            entitlementOveragePerKmCents: true,
          },
        },
      },
    });
    if (!mission) throw new NotFoundException('Mission not found');

    if (mode === 'write') this.assertMissionWrite(access, mission);
    else this.assertMissionRead(access, mission);

    // Snapshot pe misiune; dacă lipsește (legacy), citim profil doar în memorie —
    // persistarea se face sub FOR UPDATE în settleMission, ca să nu race-uiască.
    let rateCard = parseRateCardSnapshot(mission.rateCardSnapshotJson);
    if (!rateCard) {
      const profile = await this.prisma.rsaSupplierProfile.findUnique({
        where: { supplierId: mission.supplierId },
        select: {
          baseCalloutOutPlanCents: true,
          towHookOutPlanCents: true,
          towPerKmOutPlanCents: true,
          winchSurchargeCents: true,
          nightWeekendMultiplierPct: true,
        },
      });
      rateCard = {
        baseCalloutOutPlanCents: profile?.baseCalloutOutPlanCents ?? 0,
        towHookOutPlanCents: profile?.towHookOutPlanCents ?? 0,
        towPerKmOutPlanCents: profile?.towPerKmOutPlanCents ?? 0,
        winchSurchargeCents: profile?.winchSurchargeCents ?? 0,
        nightWeekendMultiplierPct: profile?.nightWeekendMultiplierPct ?? 0,
      };
    }

    const snapIncluded = mission.intervention.entitlementIncludedTowKm;
    const snapOverage = mission.intervention.entitlementOveragePerKmCents;
    const plan =
      snapIncluded != null || snapOverage != null
        ? { includedTowKm: snapIncluded, overagePerKmCents: snapOverage }
        : null;

    return {
      tenantId: tenant.id,
      mission,
      intervention: mission.intervention,
      rateCard,
      plan,
      supplierLegalName: mission.supplier.legalName,
    };
  }

  async getOrCreateProtocol(
    tenantSlug: string,
    missionId: string,
    kind: RsaHandoverKind,
    access?: AccessContext,
  ): Promise<RsaProtocolRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Mission not found');

    const mission = await this.prisma.rsaTowMission.findFirst({
      where: { id: missionId, tenantId: tenant.id },
      include: { intervention: { select: { clientId: true, vehicleId: true } } },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    this.assertMissionWrite(access, mission);

    let row = await this.prisma.rsaHandoverProtocol.findUnique({
      where: { missionId_kind: { missionId, kind } },
      include: { signatures: true, media: true },
    });
    if (!row) {
      row = await this.prisma.rsaHandoverProtocol.create({
        data: {
          tenantId: tenant.id,
          missionId,
          kind,
          checklistJson: DEFAULT_CHECKLIST,
          locationText:
            kind === RsaHandoverKind.pickup
              ? mission.pickupLocationText
              : mission.dropoffLocationText,
        },
        include: { signatures: true, media: true },
      });
    }
    return this.toProtocol(row);
  }

  async getProtocol(
    tenantSlug: string,
    protocolId: string,
    access?: AccessContext,
  ): Promise<RsaProtocolRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const row = await this.prisma.rsaHandoverProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: {
        signatures: true,
        media: true,
        mission: {
          include: {
            intervention: { select: { clientId: true, vehicleId: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Protocol not found');
    this.assertMissionRead(access, row.mission);
    return this.toProtocol(row);
  }

  async patchProtocol(
    tenantSlug: string,
    protocolId: string,
    input: {
      locationText?: string | null;
      odometerKm?: number | null;
      fuelLevelPct?: number | null;
      damageNotes?: string | null;
      inventoryNotes?: string | null;
      checklist?: Record<string, boolean>;
      counterpartyName?: string | null;
      counterpartyRoleNote?: string | null;
    },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaProtocolRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.rsaHandoverProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: {
        mission: { include: { intervention: { select: { clientId: true, vehicleId: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    this.assertMissionWrite(access, existing.mission);
    if (existing.status !== RsaHandoverProtocolStatus.draft) {
      throw new BadRequestException('Only draft protocols can be edited');
    }

    const data: Prisma.RsaHandoverProtocolUncheckedUpdateInput = {};
    if (input.locationText !== undefined) {
      data.locationText = input.locationText?.trim() || null;
    }
    if (input.odometerKm !== undefined) data.odometerKm = input.odometerKm;
    if (input.fuelLevelPct !== undefined) {
      if (input.fuelLevelPct != null && (input.fuelLevelPct < 0 || input.fuelLevelPct > 100)) {
        throw new BadRequestException('fuelLevelPct must be 0–100');
      }
      data.fuelLevelPct = input.fuelLevelPct;
    }
    if (input.damageNotes !== undefined) {
      data.damageNotes = input.damageNotes?.trim() || null;
    }
    if (input.inventoryNotes !== undefined) {
      data.inventoryNotes = input.inventoryNotes?.trim() || null;
    }
    if (input.checklist !== undefined) {
      data.checklistJson = input.checklist as Prisma.InputJsonValue;
    }
    if (input.counterpartyName !== undefined) {
      data.counterpartyName = input.counterpartyName?.trim() || null;
    }
    if (input.counterpartyRoleNote !== undefined) {
      data.counterpartyRoleNote = input.counterpartyRoleNote?.trim() || null;
    }

    const row = await this.prisma.rsaHandoverProtocol.update({
      where: { id: protocolId },
      data,
      include: { signatures: true, media: true },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_handover_protocol.patch',
      entityType: 'rsa_handover_protocol',
      entityId: protocolId,
      meta: input,
    });

    return this.toProtocol(row);
  }

  async addSignature(
    tenantSlug: string,
    protocolId: string,
    input: {
      role: RsaHandoverSignerRole;
      displayName: string;
      signaturePngUrl: string;
      strokePathJson?: Prisma.InputJsonValue | null;
      deviceMetaJson?: Prisma.InputJsonValue | null;
    },
    actorUserId?: string,
    access?: AccessContext,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.rsaHandoverProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: {
        mission: { include: { intervention: { select: { clientId: true, vehicleId: true } } } },
        signatures: true,
      },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    this.assertMissionWrite(access, existing.mission);
    if (existing.status !== RsaHandoverProtocolStatus.draft) {
      throw new BadRequestException('Protocol is not draft');
    }
    const name = input.displayName?.trim();
    const url = input.signaturePngUrl?.trim();
    if (!name || !url) throw new BadRequestException('displayName and signaturePngUrl required');
    if (existing.signatures.some((s) => s.role === input.role)) {
      throw new BadRequestException(`Signature for role ${input.role} already exists`);
    }

    await this.prisma.rsaHandoverSignature.create({
      data: {
        tenantId: tenant.id,
        protocolId,
        role: input.role,
        displayName: name,
        signaturePngUrl: url,
        strokePathJson: input.strokePathJson ?? undefined,
        deviceMetaJson: input.deviceMetaJson ?? undefined,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_handover_signature.create',
      entityType: 'rsa_handover_protocol',
      entityId: protocolId,
      meta: { role: input.role },
    });

    return this.getProtocol(tenantSlug, protocolId, access);
  }

  async addMedia(
    tenantSlug: string,
    protocolId: string,
    input: {
      kind: RsaHandoverMediaKind;
      fileUrl: string;
      fileName?: string | null;
      caption?: string | null;
    },
    actorUserId?: string,
    access?: AccessContext,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.rsaHandoverProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: {
        mission: { include: { intervention: { select: { clientId: true, vehicleId: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    this.assertMissionWrite(access, existing.mission);
    if (existing.status !== RsaHandoverProtocolStatus.draft) {
      throw new BadRequestException('Protocol is not draft');
    }
    const fileUrl = input.fileUrl?.trim();
    if (!fileUrl) throw new BadRequestException('fileUrl required');

    await this.prisma.rsaHandoverMedia.create({
      data: {
        tenantId: tenant.id,
        protocolId,
        kind: input.kind,
        fileUrl,
        fileName: input.fileName?.trim() || null,
        caption: input.caption?.trim() || null,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_handover_media.create',
      entityType: 'rsa_handover_protocol',
      entityId: protocolId,
      meta: { kind: input.kind },
    });

    return this.getProtocol(tenantSlug, protocolId, access);
  }

  async finalizeProtocol(
    tenantSlug: string,
    protocolId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaProtocolRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.rsaHandoverProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: {
        signatures: true,
        media: true,
        mission: { include: { intervention: { select: { clientId: true, vehicleId: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    this.assertMissionWrite(access, existing.mission);
    if (existing.status !== RsaHandoverProtocolStatus.draft) {
      throw new BadRequestException('Protocol already finalized');
    }
    if (existing.signatures.length < MIN_SIGNATURES) {
      throw new BadRequestException(
        `Need at least ${MIN_SIGNATURES} signatures (driver + counterparty)`,
      );
    }
    const roles = new Set(existing.signatures.map((s) => s.role));
    if (!roles.has(RsaHandoverSignerRole.driver)) {
      throw new BadRequestException('Driver signature required');
    }
    if (existing.kind === RsaHandoverKind.pickup && !roles.has(RsaHandoverSignerRole.customer)) {
      throw new BadRequestException('Customer signature required for pickup');
    }
    if (existing.kind === RsaHandoverKind.dropoff && !roles.has(RsaHandoverSignerRole.receiver)) {
      throw new BadRequestException('Receiver signature required for dropoff');
    }
    if (existing.media.length < MIN_MEDIA_FOR_SIGN) {
      throw new BadRequestException('At least one photo is required before signing off');
    }

    const row = await this.prisma.rsaHandoverProtocol.update({
      where: { id: protocolId },
      data: {
        status: RsaHandoverProtocolStatus.signed,
        signedAt: new Date(),
      },
      include: { signatures: true, media: true },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_handover_protocol.finalize',
      entityType: 'rsa_handover_protocol',
      entityId: protocolId,
      meta: { kind: existing.kind },
    });

    return this.toProtocol(row);
  }

  async downloadProtocolPdf(
    tenantSlug: string,
    protocolId: string,
    access?: AccessContext,
  ): Promise<StreamableFile> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const row = await this.prisma.rsaHandoverProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: {
        signatures: true,
        media: true,
        mission: {
          include: {
            supplier: { select: { legalName: true } },
            intervention: {
              select: {
                displayNumber: true,
                clientId: true,
                vehicleId: true,
                vehicle: { select: { registrationNumber: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Protocol not found');
    this.assertMissionRead(access, row.mission);
    if (row.status !== RsaHandoverProtocolStatus.signed) {
      throw new BadRequestException('PDF available after protocol is signed');
    }

    const buf = await buildHandoverPdf({
      kind: row.kind,
      tenantName: tenant.name,
      missionId: row.missionId,
      interventionDisplay: row.mission.intervention.displayNumber,
      vehicleReg: row.mission.intervention.vehicle?.registrationNumber ?? null,
      supplierName: row.mission.supplier.legalName,
      driverName: row.mission.driverDisplayName,
      locationText: row.locationText,
      odometerKm: row.odometerKm,
      fuelLevelPct: row.fuelLevelPct,
      damageNotes: row.damageNotes,
      inventoryNotes: row.inventoryNotes,
      counterpartyName: row.counterpartyName,
      signedAt: row.signedAt?.toISOString() ?? null,
      signatures: row.signatures.map((s) => ({
        role: s.role,
        displayName: s.displayName,
        signedAt: s.signedAt.toISOString(),
      })),
      mediaCount: row.media.length,
    });

    return new StreamableFile(buf, {
      type: 'application/pdf',
      disposition: `attachment; filename="pv-rsa-${row.kind}-${protocolId.slice(0, 8)}.pdf"`,
    });
  }
}
