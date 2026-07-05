import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  MobilityAssignmentStatus,
  MobilityDeliveryMode,
  Prisma,
  SupplierCategory,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { nextMobilityDisplayNumber } from './mobility-display-number';
import {
  computeImmobilizationHours,
  isMobilityEligible,
  MOBILITY_ELIGIBILITY_HOURS,
} from './mobility-eligibility';

const MAX_PAGE_SIZE = 200;

export type MobilityAssignmentRecord = {
  id: string;
  displayNumber: string | null;
  workOrderId: string;
  workOrderDisplayNumber: string | null;
  serviceCaseId: string;
  sourceTicketId: string | null;
  clientId: string;
  clientLegalName: string;
  coveredVehicleId: string;
  coveredVehicleReg: string | null;
  supplierId: string | null;
  supplierLegalName: string | null;
  replacementRegistration: string | null;
  status: MobilityAssignmentStatus;
  eligibilityHours: number | null;
  eligibilityTriggeredAt: string | null;
  handoverAt: string | null;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  deliveryMode: MobilityDeliveryMode | null;
  handoverUserLabel: string | null;
  waivedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobilityEligibilityRecord = {
  workOrderId: string;
  eligible: boolean;
  immobilizationHours: number | null;
  thresholdHours: number;
  inServiceAt: string | null;
  estimatedRepairAt: string | null;
  outServiceAt: string | null;
  activeAssignment: MobilityAssignmentRecord | null;
};

export type CreateMobilityAssignmentInput = {
  workOrderId: string;
  supplierId?: string | null;
  replacementRegistration?: string | null;
  deliveryMode?: MobilityDeliveryMode;
  handoverAt?: string | null;
  expectedReturnAt?: string | null;
  handoverUserLabel?: string | null;
  notes?: string | null;
  status?: 'reserved' | 'active' | 'waived';
  waivedReason?: string | null;
};

export type PatchMobilityAssignmentInput = {
  supplierId?: string | null;
  replacementRegistration?: string | null;
  deliveryMode?: MobilityDeliveryMode | null;
  handoverAt?: string | null;
  expectedReturnAt?: string | null;
  returnedAt?: string | null;
  handoverUserLabel?: string | null;
  notes?: string | null;
  status?: MobilityAssignmentStatus;
  waivedReason?: string | null;
};

export type MobilityListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: MobilityAssignmentStatus;
  workOrderId?: string;
};

type AssignmentRow = Prisma.MobilityAssignmentGetPayload<{
  include: {
    client: { select: { legalName: true } };
    coveredVehicle: { select: { registrationNumber: true } };
    supplier: { select: { legalName: true } };
    workOrder: { select: { displayNumber: true } };
  };
}>;

@Injectable()
export class MobilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toRecord(row: AssignmentRow): MobilityAssignmentRecord {
    return {
      id: row.id,
      displayNumber: row.displayNumber,
      workOrderId: row.workOrderId,
      workOrderDisplayNumber: row.workOrder.displayNumber,
      serviceCaseId: row.serviceCaseId,
      sourceTicketId: row.sourceTicketId,
      clientId: row.clientId,
      clientLegalName: row.client.legalName,
      coveredVehicleId: row.coveredVehicleId,
      coveredVehicleReg: row.coveredVehicleRegSnapshot ?? row.coveredVehicle.registrationNumber,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier?.legalName ?? null,
      replacementRegistration: row.replacementRegistration,
      status: row.status,
      eligibilityHours: row.eligibilityHours,
      eligibilityTriggeredAt: row.eligibilityTriggeredAt?.toISOString() ?? null,
      handoverAt: row.handoverAt?.toISOString() ?? null,
      expectedReturnAt: row.expectedReturnAt?.toISOString() ?? null,
      returnedAt: row.returnedAt?.toISOString() ?? null,
      deliveryMode: row.deliveryMode,
      handoverUserLabel: row.handoverUserLabel,
      waivedReason: row.waivedReason,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private includeRelations() {
    return {
      client: { select: { legalName: true } },
      coveredVehicle: { select: { registrationNumber: true } },
      supplier: { select: { legalName: true } },
      workOrder: { select: { displayNumber: true } },
    } as const;
  }

  private listWhere(tenantId: string, params: MobilityListParams): Prisma.MobilityAssignmentWhereInput {
    const parts: Prisma.MobilityAssignmentWhereInput[] = [{ tenantId }];
    if (params.status) parts.push({ status: params.status });
    if (params.workOrderId) parts.push({ workOrderId: params.workOrderId });
    const q = params.q?.trim();
    if (q) {
      parts.push({
        OR: [
          { displayNumber: { contains: q, mode: 'insensitive' } },
          { replacementRegistration: { contains: q, mode: 'insensitive' } },
          { coveredVehicleRegSnapshot: { contains: q, mode: 'insensitive' } },
          { handoverUserLabel: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    return { AND: parts };
  }

  async listPaged(tenantSlug: string, params: MobilityListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;
    const where = this.listWhere(tenant.id, params);

    const [total, rows] = await Promise.all([
      this.prisma.mobilityAssignment.count({ where }),
      this.prisma.mobilityAssignment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: this.includeRelations(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page,
      pageSize,
    };
  }

  async getById(tenantSlug: string, id: string): Promise<MobilityAssignmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Assignment not found');
    const row = await this.prisma.mobilityAssignment.findFirst({
      where: { id, tenantId: tenant.id },
      include: this.includeRelations(),
    });
    if (!row) throw new NotFoundException('Assignment not found');
    return this.toRecord(row);
  }

  async getEligibility(tenantSlug: string, workOrderId: string): Promise<MobilityEligibilityRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Work order not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: workOrderId, tenantId: tenant.id },
      select: {
        id: true,
        inServiceAt: true,
        estimatedRepairAt: true,
        outServiceAt: true,
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const hours = computeImmobilizationHours(
      wo.inServiceAt,
      wo.estimatedRepairAt,
      wo.outServiceAt,
    );
    const eligible = isMobilityEligible(wo.inServiceAt, wo.estimatedRepairAt, wo.outServiceAt);

    const activeRow = await this.prisma.mobilityAssignment.findFirst({
      where: {
        tenantId: tenant.id,
        workOrderId,
        status: { in: ['draft', 'eligible', 'reserved', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
      include: this.includeRelations(),
    });

    return {
      workOrderId,
      eligible,
      immobilizationHours: hours,
      thresholdHours: MOBILITY_ELIGIBILITY_HOURS,
      inServiceAt: wo.inServiceAt?.toISOString() ?? null,
      estimatedRepairAt: wo.estimatedRepairAt?.toISOString() ?? null,
      outServiceAt: wo.outServiceAt?.toISOString() ?? null,
      activeAssignment: activeRow ? this.toRecord(activeRow) : null,
    };
  }

  private mobilityEventBody(
    displayNumber: string | null,
    status: MobilityAssignmentStatus,
    replacementRegistration: string | null,
  ): string {
    const nr = displayNumber ?? '—';
    const reg = replacementRegistration?.trim();
    switch (status) {
      case 'waived':
        return `Client eligibil pentru mobilitate — s-a renunțat la mașina la schimb (${nr}).`;
      case 'returned':
        return reg
          ? `Mașina la schimb ${reg} returnată (${nr}).`
          : `Mașina la schimb returnată (${nr}).`;
      case 'active':
        return reg
          ? `Mașină la schimb activă: ${reg} (${nr}). Beneficiați de mobilitate pe durata reparației.`
          : `Alocare mobilitate activă (${nr}). Beneficiați de mașină la schimb pe durata reparației.`;
      case 'reserved':
        return reg
          ? `Mașină la schimb rezervată: ${reg} (${nr}).`
          : `Rezervare mașină la schimb (${nr}).`;
      default:
        return `Actualizare mobilitate (${nr}).`;
    }
  }

  private async appendTicketEvent(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ticketId: string | null | undefined,
    assignment: {
      id: string;
      displayNumber: string | null;
      status: MobilityAssignmentStatus;
      replacementRegistration: string | null;
    },
    actorUserId?: string,
  ) {
    if (!ticketId) return;
    await tx.crmTicketEvent.create({
      data: {
        tenantId,
        ticketId,
        kind: CrmTicketEventKind.mobility_update,
        body: this.mobilityEventBody(
          assignment.displayNumber,
          assignment.status,
          assignment.replacementRegistration,
        ),
        payload: {
          assignmentId: assignment.id,
          displayNumber: assignment.displayNumber,
          status: assignment.status,
          replacementRegistration: assignment.replacementRegistration,
        },
        actorUserId: actorUserId ?? null,
      },
    });
  }

  async create(
    tenantSlug: string,
    input: CreateMobilityAssignmentInput,
    actorUserId?: string,
  ): Promise<MobilityAssignmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: input.workOrderId, tenantId: tenant.id },
      include: {
        serviceCase: { select: { id: true, clientId: true, sourceTicketId: true } },
        vehicle: { select: { id: true, registrationNumber: true } },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const hours = computeImmobilizationHours(
      wo.inServiceAt,
      wo.estimatedRepairAt,
      wo.outServiceAt,
    );
    const eligible = isMobilityEligible(wo.inServiceAt, wo.estimatedRepairAt, wo.outServiceAt);
    const targetStatus = input.status ?? 'reserved';

    if (targetStatus === 'waived') {
      if (!input.waivedReason?.trim()) {
        throw new BadRequestException('waivedReason is required when waiving mobility');
      }
    } else if (!eligible) {
      throw new BadRequestException(
        `Comanda nu este eligibilă pentru mobilitate (prag ${MOBILITY_ELIGIBILITY_HOURS}h imobilizare).`,
      );
    }

    if (targetStatus !== 'waived') {
      if (!input.replacementRegistration?.trim()) {
        throw new BadRequestException('replacementRegistration is required');
      }
      if (!input.deliveryMode) {
        throw new BadRequestException('deliveryMode is required');
      }
      if (!input.handoverUserLabel?.trim()) {
        throw new BadRequestException('handoverUserLabel is required');
      }
    }

    if (input.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: input.supplierId, tenantId: tenant.id, category: SupplierCategory.rent },
      });
      if (!supplier) {
        throw new BadRequestException('supplierId must be an active Rent supplier');
      }
    }

    const existing = await this.prisma.mobilityAssignment.findFirst({
      where: {
        tenantId: tenant.id,
        workOrderId: wo.id,
        status: { in: ['reserved', 'active'] },
      },
    });
    if (existing && targetStatus !== 'waived') {
      throw new BadRequestException('Există deja o alocare activă sau rezervată pe această comandă.');
    }

    const now = new Date();
    let status: MobilityAssignmentStatus = targetStatus;
    if (targetStatus === 'active' || input.handoverAt) {
      status = 'active';
    } else if (targetStatus === 'waived') {
      status = 'waived';
    } else {
      status = 'reserved';
    }

    const displayNumber = await nextMobilityDisplayNumber(this.prisma, tenant.id, now);
    const handoverAt = input.handoverAt ? new Date(input.handoverAt) : status === 'active' ? now : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mobilityAssignment.create({
        data: {
          tenantId: tenant.id,
          displayNumber,
          workOrderId: wo.id,
          serviceCaseId: wo.serviceCaseId,
          sourceTicketId: wo.serviceCase.sourceTicketId,
          clientId: wo.serviceCase.clientId,
          coveredVehicleId: wo.vehicleId,
          coveredVehicleRegSnapshot: wo.vehicle.registrationNumber,
          supplierId: input.supplierId ?? null,
          replacementRegistration: input.replacementRegistration?.trim() || null,
          status,
          eligibilityHours: hours != null ? Math.ceil(hours) : null,
          eligibilityTriggeredAt: eligible ? now : null,
          handoverAt,
          expectedReturnAt: input.expectedReturnAt ? new Date(input.expectedReturnAt) : null,
          deliveryMode: input.deliveryMode ?? null,
          handoverUserLabel: input.handoverUserLabel?.trim() || null,
          waivedReason: input.waivedReason?.trim() || null,
          notes: input.notes?.trim() || null,
        },
        include: this.includeRelations(),
      });

      await this.appendTicketEvent(
        tx,
        tenant.id,
        wo.serviceCase.sourceTicketId,
        {
          id: row.id,
          displayNumber: row.displayNumber,
          status: row.status,
          replacementRegistration: row.replacementRegistration,
        },
        actorUserId,
      );

      return row;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'mobility_assignment.create',
      entityType: 'mobility_assignment',
      entityId: created.id,
      meta: { workOrderId: wo.id, status },
    });

    return this.toRecord(created);
  }

  async patch(
    tenantSlug: string,
    id: string,
    input: PatchMobilityAssignmentInput,
    actorUserId?: string,
  ): Promise<MobilityAssignmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Assignment not found');

    const existing = await this.prisma.mobilityAssignment.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Assignment not found');

    const data: Prisma.MobilityAssignmentUncheckedUpdateInput = {};
    if (input.supplierId !== undefined) data.supplierId = input.supplierId;
    if (input.replacementRegistration !== undefined) {
      data.replacementRegistration = input.replacementRegistration?.trim() || null;
    }
    if (input.deliveryMode !== undefined) data.deliveryMode = input.deliveryMode;
    if (input.handoverAt !== undefined) {
      data.handoverAt = input.handoverAt ? new Date(input.handoverAt) : null;
    }
    if (input.expectedReturnAt !== undefined) {
      data.expectedReturnAt = input.expectedReturnAt ? new Date(input.expectedReturnAt) : null;
    }
    if (input.returnedAt !== undefined) {
      data.returnedAt = input.returnedAt ? new Date(input.returnedAt) : null;
    }
    if (input.handoverUserLabel !== undefined) {
      data.handoverUserLabel = input.handoverUserLabel?.trim() || null;
    }
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.waivedReason !== undefined) data.waivedReason = input.waivedReason?.trim() || null;

    let statusChanged = false;
    if (input.status !== undefined) {
      data.status = input.status;
      statusChanged = input.status !== existing.status;
      if (input.status === 'active' && !input.handoverAt && !existing.handoverAt) {
        data.handoverAt = new Date();
      }
      if (input.status === 'returned' && !input.returnedAt && !existing.returnedAt) {
        data.returnedAt = new Date();
      }
      if (input.status === 'waived' && !input.waivedReason && !existing.waivedReason) {
        throw new BadRequestException('waivedReason is required when waiving');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mobilityAssignment.update({
        where: { id },
        data,
        include: this.includeRelations(),
      });

      if (statusChanged) {
        await this.appendTicketEvent(
          tx,
          tenant.id,
          existing.sourceTicketId,
          {
            id: row.id,
            displayNumber: row.displayNumber,
            status: row.status,
            replacementRegistration: row.replacementRegistration,
          },
          actorUserId,
        );
      }

      return row;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'mobility_assignment.patch',
      entityType: 'mobility_assignment',
      entityId: id,
      meta: input,
    });

    return this.toRecord(updated);
  }
}
