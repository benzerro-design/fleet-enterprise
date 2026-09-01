import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  CrmTicketLinkEntityType,
  CrmTicketStatus,
  DamageClaimStatus,
  DamageInsuranceType,
  DamageInsurerPipelineStatus,
  DamagePayerType,
  MaintenanceWorkOrderStatus,
  Prisma,
  RoadsideInterventionStatus,
  ServiceCaseStage,
  ServiceCaseStatus,
  ServiceCaseWorkflowType,
  ServiceOrderType,
  VehicleMovableState,
  WorkOrderQuoteStatus,
  WorkOrderWarrantyStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { assertClientAccess, assertClientFleetWrite, isTenantWideAccess } from '../iam/client-access';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertPartnerSupplierId,
  assertPartnerWrite,
  isPartnerUser,
} from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';
import { parseWorkOrderSettings } from '../tenant/work-order-settings';
import { ensureWorkOrderDisplayNumber } from './work-order-display-number';
import {
  assertDamageReadyForRepair,
  assertImmovableRoadsideForReception,
} from './damage-repair-gates';
import {
  SERVICE_CASE_STAGE_ORDER,
  type DamageDocumentItem,
  type DamageInsurerMailLogItem,
  type DamagePhotoItem,
  type DamageSectionLocks,
} from '../service-cases/service-cases.service';

const MAX_PAGE_SIZE = 200;

export type WorkOrderVehicleSnapshot = {
  registrationNumber: string;
  brand: string | null;
  model: string | null;
  vin: string | null;
  odometerKm: number;
  itpExpiresOn: string | null;
};

export type WorkOrderClientSnapshot = {
  legalName: string;
  taxId: string | null;
  addressLine: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  billingNotes: string | null;
};

export type WorkOrderSupplierSnapshot = {
  legalName: string;
  taxId: string | null;
  addressLine: string | null;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  partsDiscountPercent: number;
  laborDiscountPercent: number;
};

export type WorkOrderListRow = {
  id: string;
  title: string;
  displayNumber: string | null;
  status: MaintenanceWorkOrderStatus;
  serviceOrderType: ServiceOrderType;
  createdAt: string;
  updatedAt: string;
  plannedAt: string | null;
  completedAt: string | null;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierLegalName: string | null;
  serviceCaseId: string;
  serviceCaseStage: string;
  serviceCaseStatus: string;
  workflowType: string;
  sourceTicketId: string | null;
  ticketDisplayId: string | null;
  ticketSubject: string | null;
  readyAt: string | null;
  estimatedRepairAt: string | null;
  quoteSummary: {
    status: string | null;
    version: number | null;
    totalGrossCents: number | null;
    currency: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
    invoicedAt: string | null;
  };
};

export type WorkOrderTicketSettlement = {
  entityType: 'maintenance' | 'cost' | 'document';
  entityId: string;
  createdAt: string;
};

export type WorkOrderDetail = WorkOrderListRow & {
  notes: string | null;
  serviceCaseTitle: string;
  serviceCaseStatus: string;
  awaitingPostApproval: boolean;
  postApprovalPath: 'immediate' | 'reschedule' | null;
  linkedAppointmentId: string | null;
  linkedAppointmentScheduledAt: string | null;
  linkedAppointmentStatus: string | null;
  inServiceAt: string | null;
  outServiceAt: string | null;
  visit2InServiceAt: string | null;
  visit2OutServiceAt: string | null;
  odometerKmIn: number | null;
  odometerKmOut: number | null;
  visit2OdometerKmIn: number | null;
  visit2OdometerKmOut: number | null;
  repairPathNote: string | null;
  readyAt: string | null;
  /** Etapă suplimentară după deviz aprobat v2+ (partener). */
  supplementRepairAt: string | null;
  supplementQuoteVersion: number | null;
  /** Transformare din Acțiuni (mentenanță/cost/document) pe tichetul sursă. */
  ticketSettlement: WorkOrderTicketSettlement | null;
  /** Cost generat din devizul aprobat. */
  hasQuoteCost: boolean;
  vehicle: WorkOrderVehicleSnapshot;
  client: WorkOrderClientSnapshot;
  supplier: WorkOrderSupplierSnapshot | null;
  ticketSubject: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehicleMovable: VehicleMovableState | null;
  /** YYYY-MM-DD */
  damageEventOn: string | null;
  damagePayerType: DamagePayerType | null;
  damageInsurerPipelineStatus: DamageInsurerPipelineStatus | null;
  damageInsuranceType: DamageInsuranceType | null;
  damageClaimNumber: string | null;
  damageInsurerName: string | null;
  damageInsurerId: string | null;
  damageClaimStatus: DamageClaimStatus | null;
  damageInsurerAgreedAt: string | null;
  damageDocuments: DamageDocumentItem[];
  damagePhotos: DamagePhotoItem[];
  damageSectionLocks: DamageSectionLocks;
  damageCascoFranchiseCents: number | null;
  damageInsurerEmail: string | null;
  damageQuoteOrigin: 'prepared_by_us' | 'received_from_insurer' | null;
  damageInsurerQuotePdfUrl: string | null;
  damageInsurerMailLog: DamageInsurerMailLogItem[];
  damageInspectionMode: 'photos' | 'on_site' | null;
  damageInspectionNotePdfUrl: string | null;
  damageInspectionNoteFileName: string | null;
  damageInspectionNoteIssuedOn: string | null;
  damageInspectionNoteReceivedAt: string | null;
  damageInspectionNoteNotes: string | null;
  damageInspectionNotes: Array<
    | {
        id: string;
        kind?: 'inspection_note' | 'pvs';
        sequence?: number;
        requestId?: string;
        pdfUrl: string;
        fileName?: string;
        mode?: 'photos' | 'on_site' | null;
        issuedOn?: string | null;
        receivedAt: string;
        notes?: string | null;
      }
    | {
        id: string;
        kind: 'reinspection_request';
        sequence: number;
        status: 'pending' | 'approved' | 'rejected';
        explanation: string;
        photoIds: string[];
        sentAt: string;
        decidedAt?: string;
        rejectionReason?: string;
        approvalDocUrl?: string;
        approvalDocFileName?: string;
        linkedPvsId?: string;
        mailLogId?: string;
      }
  >;
  damagePaymentAcceptancePdfUrl: string | null;
  damagePaymentAcceptanceFileName: string | null;
  damagePaymentAcceptanceReceivedAt: string | null;
  damagePaymentAcceptanceNotes: string | null;
  damagePaymentAcceptances: Array<{
    id: string;
    sequence: number;
    pdfUrl: string;
    fileName?: string;
    receivedAt: string;
    notes?: string | null;
  }>;
  quoteSummary: {
    status: string | null;
    version: number | null;
    totalGrossCents: number | null;
    currency: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
    invoicedAt: string | null;
  };
};

/** Răspuns PATCH service-times — include dacă odometrul flotă a fost actualizat. */
export type ServiceTimesResult = WorkOrderDetail & {
  fleetOdometerUpdate: {
    updated: boolean;
    previousKm: number;
    newKm: number | null;
  };
};

export type WorkOrderInbox = 'open' | 'pending_approval' | 'in_service' | 'ready' | 'invoiced';

export type WorkOrderListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: MaintenanceWorkOrderStatus;
  supplierId?: string;
  supplierIds?: string[];
  vehicleId?: string;
  clientId?: string;
  serviceCaseStage?: ServiceCaseStage;
  serviceOrderType?: ServiceOrderType;
  inbox?: WorkOrderInbox;
};

export type WorkOrderStats = {
  open: number;
  inProgress: number;
  waitingParts: number;
  done: number;
  pendingApproval: number;
  readyUninvoiced: number;
};

function ticketDisplayId(ticketId: string | null | undefined): string | null {
  if (!ticketId) return null;
  return ticketId.slice(-6).toUpperCase();
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertWorkOrderWrite(
    access: AccessContext,
    wo: { supplierId: string | null; vehicle: { clientId: string } },
  ): void {
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, wo.supplierId);
      assertPartnerWrite(access);
      return;
    }
    assertClientFleetWrite(access, wo.vehicle.clientId);
  }

  /** Listă / KPI: client_user vede doar WO-urile clienților săi (ca Programator). */
  private workOrderClientScope(access?: AccessContext): Prisma.MaintenanceWorkOrderWhereInput {
    if (!access || isTenantWideAccess(access) || isPartnerUser(access)) return {};
    if (access.allowedClientIds.length === 0) {
      return { vehicle: { clientId: { in: [] } } };
    }
    return { vehicle: { clientId: { in: access.allowedClientIds } } };
  }

  private assertClientIdQuery(access: AccessContext | undefined, clientId?: string): void {
    if (!access || isTenantWideAccess(access) || isPartnerUser(access) || !clientId?.trim()) return;
    if (!access.allowedClientIds.includes(clientId.trim())) {
      throw new ForbiddenException('Client access denied');
    }
  }

  private assertWorkOrderRead(
    access: AccessContext,
    wo: { supplierId: string | null; vehicle: { clientId: string } },
  ): void {
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, wo.supplierId);
      return;
    }
    if (isTenantWideAccess(access)) return;
    assertClientAccess(access, wo.vehicle.clientId);
  }

  private listInclude() {
    return {
      vehicle: {
        select: {
          registrationNumber: true,
          clientId: true,
          client: { select: { code: true, legalName: true } },
        },
      },
      supplier: { select: { id: true, code: true, legalName: true } },
      serviceCase: {
        select: {
          id: true,
          title: true,
          status: true,
          currentStage: true,
          workflowType: true,
          sourceTicketId: true,
          clientId: true,
          sourceTicket: { select: { subject: true } },
        },
      },
      quotes: {
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          status: true,
          version: true,
          totalNetCents: true,
          totalVatCents: true,
          approvedNetCents: true,
          approvedVatCents: true,
          currency: true,
          submittedAt: true,
          approvedAt: true,
          invoicedAt: true,
        },
      },
    } as const;
  }

  private quoteSummaryFromRow(
    quote:
      | {
          status: WorkOrderQuoteStatus;
          version: number;
          totalNetCents: number;
          totalVatCents: number;
          approvedNetCents?: number | null;
          approvedVatCents?: number | null;
          currency: string;
          submittedAt: Date | null;
          approvedAt: Date | null;
          invoicedAt: Date | null;
        }
      | undefined,
  ) {
    if (!quote) {
      return {
        status: null,
        version: null,
        totalGrossCents: null,
        currency: null,
        submittedAt: null,
        approvedAt: null,
        invoicedAt: null,
      };
    }
    return {
      status: quote.status,
      version: quote.version,
      totalGrossCents:
        quote.approvedNetCents != null && quote.approvedVatCents != null
          ? quote.approvedNetCents + quote.approvedVatCents
          : quote.totalNetCents + quote.totalVatCents,
      currency: quote.currency,
      submittedAt: quote.submittedAt?.toISOString() ?? null,
      approvedAt: quote.approvedAt?.toISOString() ?? null,
      invoicedAt: quote.invoicedAt?.toISOString() ?? null,
    };
  }

  private toListRow(row: {
    id: string;
    title: string;
    displayNumber: string | null;
    status: MaintenanceWorkOrderStatus;
    serviceOrderType: ServiceOrderType;
    createdAt: Date;
    updatedAt: Date;
    plannedAt: Date | null;
    completedAt: Date | null;
    readyAt: Date | null;
    estimatedRepairAt: Date | null;
    vehicleId: string;
    supplierId: string | null;
    serviceCaseId: string;
    vehicle: {
      registrationNumber: string;
      clientId: string;
      client: { code: string; legalName: string };
    };
    supplier: { code: string; legalName: string } | null;
    serviceCase: {
      status: ServiceCaseStatus;
      currentStage: string;
      workflowType: string;
      sourceTicketId: string | null;
      sourceTicket?: { subject: string } | null;
    };
    quotes?: Array<{
      status: WorkOrderQuoteStatus;
      version: number;
      totalNetCents: number;
      totalVatCents: number;
      currency: string;
      submittedAt: Date | null;
      approvedAt: Date | null;
      invoicedAt: Date | null;
    }>;
  }): WorkOrderListRow {
    return {
      id: row.id,
      title: row.title,
      displayNumber: row.displayNumber ?? null,
      status: row.status,
      serviceOrderType: row.serviceOrderType,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      plannedAt: row.plannedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle.registrationNumber,
      clientId: row.vehicle.clientId,
      clientCode: row.vehicle.client.code,
      clientLegalName: row.vehicle.client.legalName,
      supplierId: row.supplierId,
      supplierCode: row.supplier?.code ?? null,
      supplierLegalName: row.supplier?.legalName ?? null,
      serviceCaseId: row.serviceCaseId,
      serviceCaseStage: row.serviceCase.currentStage,
      serviceCaseStatus: row.serviceCase.status,
      workflowType: row.serviceCase.workflowType,
      sourceTicketId: row.serviceCase.sourceTicketId,
      ticketDisplayId: ticketDisplayId(row.serviceCase.sourceTicketId),
      ticketSubject: row.serviceCase.sourceTicket?.subject ?? null,
      readyAt: row.readyAt?.toISOString() ?? null,
      estimatedRepairAt: row.estimatedRepairAt?.toISOString() ?? null,
      quoteSummary: this.quoteSummaryFromRow(row.quotes?.[0]),
    };
  }

  private listWhere(
    tenantId: string,
    params: WorkOrderListParams,
    access?: AccessContext,
  ): Prisma.MaintenanceWorkOrderWhereInput {
    const parts: Prisma.MaintenanceWorkOrderWhereInput[] = [{ tenantId }];
    const clientScope = this.workOrderClientScope(access);
    if (Object.keys(clientScope).length > 0) parts.push(clientScope);
    if (params.status) parts.push({ status: params.status });
    if (params.supplierIds?.length) {
      parts.push({ supplierId: { in: params.supplierIds } });
    } else if (params.supplierId?.trim()) {
      parts.push({ supplierId: params.supplierId.trim() });
    }
    if (params.vehicleId?.trim()) parts.push({ vehicleId: params.vehicleId.trim() });
    if (params.clientId?.trim()) {
      parts.push({
        OR: [
          { vehicle: { clientId: params.clientId.trim() } },
          { serviceCase: { clientId: params.clientId.trim() } },
        ],
      });
    }
    if (params.serviceCaseStage) {
      parts.push({ serviceCase: { currentStage: params.serviceCaseStage } });
    }
    if (params.serviceOrderType) {
      parts.push({ serviceOrderType: params.serviceOrderType });
    }
    if (params.inbox === 'open') {
      parts.push({
        status: {
          notIn: [MaintenanceWorkOrderStatus.done, MaintenanceWorkOrderStatus.cancelled],
        },
        serviceCase: { status: ServiceCaseStatus.active },
      });
    } else if (params.inbox === 'pending_approval') {
      parts.push({ quotes: { some: { status: WorkOrderQuoteStatus.submitted } } });
    } else if (params.inbox === 'in_service') {
      parts.push({ serviceCase: { currentStage: ServiceCaseStage.in_service } });
    } else if (params.inbox === 'ready') {
      parts.push({
        readyAt: { not: null },
        NOT: { quotes: { some: { invoicedAt: { not: null } } } },
      });
    } else if (params.inbox === 'invoiced') {
      parts.push({ quotes: { some: { invoicedAt: { not: null } } } });
    }
    const q = params.q?.trim();
    if (q) {
      parts.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { vehicle: { registrationNumber: { contains: q, mode: 'insensitive' } } },
          { supplier: { legalName: { contains: q, mode: 'insensitive' } } },
          { supplier: { code: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    return { AND: parts };
  }

  async listPaged(tenantSlug: string, params: WorkOrderListParams, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    this.assertClientIdQuery(access, params.clientId);
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;
    const where = this.listWhere(tenant.id, params, access);

    const [total, rows] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({ where }),
      this.prisma.maintenanceWorkOrder.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: this.listInclude(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toListRow(r)),
      total,
      page,
      pageSize,
    };
  }

  async getStats(
    tenantSlug: string,
    clientId?: string,
    supplierIds?: string[],
    access?: AccessContext,
  ): Promise<WorkOrderStats> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return { open: 0, inProgress: 0, waitingParts: 0, done: 0, pendingApproval: 0, readyUninvoiced: 0 };
    this.assertClientIdQuery(access, clientId);

    const clientFilter: Prisma.MaintenanceWorkOrderWhereInput | undefined = clientId?.trim()
      ? {
          OR: [
            { vehicle: { clientId: clientId.trim() } },
            { serviceCase: { clientId: clientId.trim() } },
          ],
        }
      : undefined;

    const supplierFilter: Prisma.MaintenanceWorkOrderWhereInput | undefined = supplierIds?.length
      ? { supplierId: { in: supplierIds } }
      : undefined;

    const scopeFilter = this.workOrderClientScope(access);
    const extra = [clientFilter, supplierFilter, Object.keys(scopeFilter).length > 0 ? scopeFilter : undefined].filter(
      Boolean,
    ) as Prisma.MaintenanceWorkOrderWhereInput[];
    const base: Prisma.MaintenanceWorkOrderWhereInput = {
      tenantId: tenant.id,
      ...(extra.length ? { AND: extra } : {}),
    };

    const [open, inProgress, waitingParts, done, pendingApproval, readyUninvoiced] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({
        where: {
          ...base,
          status: {
            notIn: [MaintenanceWorkOrderStatus.done, MaintenanceWorkOrderStatus.cancelled],
          },
          serviceCase: { status: ServiceCaseStatus.active },
        },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { ...base, status: MaintenanceWorkOrderStatus.in_progress },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { ...base, status: MaintenanceWorkOrderStatus.waiting_parts },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { ...base, status: MaintenanceWorkOrderStatus.done },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: { ...base, quotes: { some: { status: WorkOrderQuoteStatus.submitted } } },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: {
          ...base,
          readyAt: { not: null },
          NOT: { quotes: { some: { invoicedAt: { not: null } } } },
        },
      }),
    ]);

    return { open, inProgress, waitingParts, done, pendingApproval, readyUninvoiced };
  }

  async getById(tenantSlug: string, id: string, access?: AccessContext): Promise<WorkOrderDetail> {
    const row = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: {
        ...this.listInclude(),
        vehicle: {
          select: {
            registrationNumber: true,
            clientId: true,
            brand: true,
            model: true,
            vin: true,
            odometerKm: true,
            itpExpiresOn: true,
            client: {
              select: {
                code: true,
                legalName: true,
                taxId: true,
                addressLine: true,
                contactPhone: true,
                contactEmail: true,
                billingNotes: true,
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            legalName: true,
            taxId: true,
            addressLine: true,
            city: true,
            contactPhone: true,
            contactEmail: true,
            partsDiscountPercent: true,
            laborDiscountPercent: true,
          },
        },
        serviceCase: {
          select: {
            id: true,
            title: true,
            status: true,
            currentStage: true,
            workflowType: true,
            sourceTicketId: true,
            clientId: true,
            awaitingPostApproval: true,
            postApprovalPath: true,
            vehicleMovable: true,
            damageEventOn: true,
            damagePayerType: true,
            damageInsurerPipelineStatus: true,
            damageInsuranceType: true,
            damageClaimNumber: true,
            damageInsurerName: true,
            damageInsurerId: true,
            damageClaimStatus: true,
            damageInsurerAgreedAt: true,
            damageDocumentsJson: true,
            damagePhotosJson: true,
            damageSectionLocksJson: true,
            damageCascoFranchiseCents: true,
            damageInsurerEmail: true,
            damageQuoteOrigin: true,
            damageInsurerQuotePdfUrl: true,
            damageInsurerMailLogJson: true,
            damageInspectionMode: true,
            damageInspectionNotePdfUrl: true,
            damageInspectionNoteFileName: true,
            damageInspectionNoteIssuedOn: true,
            damageInspectionNoteReceivedAt: true,
            damageInspectionNoteNotes: true,
            damageInspectionNotesJson: true,
            damagePaymentAcceptancePdfUrl: true,
            damagePaymentAcceptanceFileName: true,
            damagePaymentAcceptanceReceivedAt: true,
            damagePaymentAcceptanceNotes: true,
            damagePaymentAcceptancesJson: true,
            createdAt: true,
            sourceTicket: {
              select: {
                subject: true,
                driver: { select: { fullName: true, phone: true } },
              },
            },
          },
        },
        quotes: {
          orderBy: { version: 'desc' },
          take: 5,
          select: {
            id: true,
            version: true,
            status: true,
            currency: true,
            totalNetCents: true,
            totalVatCents: true,
            approvedNetCents: true,
            approvedVatCents: true,
            submittedAt: true,
            approvedAt: true,
            invoicedAt: true,
            costEntryId: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Work order not found');

    if (access) {
      this.assertWorkOrderRead(access, row);
    }

    if (!row.displayNumber) {
      row.displayNumber = await this.prisma.$transaction((tx) =>
        ensureWorkOrderDisplayNumber(tx, row.tenantId, row.id, row.createdAt, row.displayNumber),
      );
    }

    const linked = await this.resolveLinkedAppointment(row.tenantId, row.serviceCaseId, row.plannedAt);

    const list = this.toListRow(row);
    const approved = row.quotes.find((q) => q.status === 'approved');
    const submitted = row.quotes.find((q) => q.status === 'submitted');
    const draft = row.quotes.find((q) => q.status === 'draft');
    const primary = approved ?? submitted ?? draft ?? row.quotes[0];

    const ticketSettlement = await this.resolveTicketSettlement(
      row.tenantId,
      row.serviceCase.sourceTicketId,
    );
    const hasQuoteCost = row.quotes.some((q) => q.status === 'approved' && !!q.costEntryId);

    return {
      ...list,
      notes: row.notes,
      serviceCaseTitle: row.serviceCase.title,
      serviceCaseStatus: row.serviceCase.status,
      awaitingPostApproval: row.serviceCase.awaitingPostApproval ?? false,
      postApprovalPath: row.serviceCase.postApprovalPath ?? null,
      linkedAppointmentId: linked?.id ?? null,
      linkedAppointmentScheduledAt: linked?.scheduledAt.toISOString() ?? null,
      linkedAppointmentStatus: linked?.status ?? null,
      inServiceAt: row.inServiceAt?.toISOString() ?? null,
      outServiceAt: row.outServiceAt?.toISOString() ?? null,
      visit2InServiceAt: row.visit2InServiceAt?.toISOString() ?? null,
      visit2OutServiceAt: row.visit2OutServiceAt?.toISOString() ?? null,
      odometerKmIn: row.odometerKmIn ?? null,
      odometerKmOut: row.odometerKmOut ?? null,
      visit2OdometerKmIn: row.visit2OdometerKmIn ?? null,
      visit2OdometerKmOut: row.visit2OdometerKmOut ?? null,
      repairPathNote: row.repairPathNote ?? null,
      readyAt: row.readyAt?.toISOString() ?? null,
      supplementRepairAt: row.supplementRepairAt?.toISOString() ?? null,
      supplementQuoteVersion: row.supplementQuoteVersion ?? null,
      estimatedRepairAt: row.estimatedRepairAt?.toISOString() ?? null,
      ticketSettlement,
      hasQuoteCost,
      vehicle: {
        registrationNumber: row.vehicle.registrationNumber,
        brand: row.vehicle.brand,
        model: row.vehicle.model,
        vin: row.vehicle.vin,
        odometerKm: row.vehicle.odometerKm,
        itpExpiresOn: row.vehicle.itpExpiresOn?.toISOString() ?? null,
      },
      client: {
        legalName: row.vehicle.client.legalName,
        taxId: row.vehicle.client.taxId,
        addressLine: row.vehicle.client.addressLine,
        contactPhone: row.vehicle.client.contactPhone,
        contactEmail: row.vehicle.client.contactEmail,
        billingNotes: row.vehicle.client.billingNotes,
      },
      supplier: row.supplier
        ? {
            legalName: row.supplier.legalName,
            taxId: row.supplier.taxId,
            addressLine: row.supplier.addressLine,
            city: row.supplier.city,
            contactPhone: row.supplier.contactPhone,
            contactEmail: row.supplier.contactEmail,
            partsDiscountPercent: Number(row.supplier.partsDiscountPercent) || 0,
            laborDiscountPercent: Number(row.supplier.laborDiscountPercent) || 0,
          }
        : null,
      ticketSubject: row.serviceCase.sourceTicket?.subject ?? null,
      driverName: row.serviceCase.sourceTicket?.driver?.fullName ?? null,
      driverPhone: row.serviceCase.sourceTicket?.driver?.phone ?? null,
      vehicleMovable: row.serviceCase.vehicleMovable ?? null,
      damageEventOn: row.serviceCase.damageEventOn
        ? row.serviceCase.damageEventOn.toISOString().slice(0, 10)
        : null,
      damagePayerType: row.serviceCase.damagePayerType ?? null,
      damageInsurerPipelineStatus: row.serviceCase.damageInsurerPipelineStatus ?? null,
      damageInsuranceType: row.serviceCase.damageInsuranceType ?? null,
      damageClaimNumber: row.serviceCase.damageClaimNumber ?? null,
      damageInsurerName: row.serviceCase.damageInsurerName ?? null,
      damageInsurerId: row.serviceCase.damageInsurerId ?? null,
      damageClaimStatus: row.serviceCase.damageClaimStatus ?? null,
      damageInsurerAgreedAt: row.serviceCase.damageInsurerAgreedAt?.toISOString() ?? null,
      damageDocuments: this.parseDamageDocuments(row.serviceCase.damageDocumentsJson),
      damagePhotos: this.parseDamagePhotos(row.serviceCase.damagePhotosJson),
      damageSectionLocks: this.parseDamageSectionLocks(row.serviceCase.damageSectionLocksJson),
      damageCascoFranchiseCents: row.serviceCase.damageCascoFranchiseCents ?? null,
      damageInsurerEmail: row.serviceCase.damageInsurerEmail ?? null,
      damageQuoteOrigin: row.serviceCase.damageQuoteOrigin ?? null,
      damageInsurerQuotePdfUrl: row.serviceCase.damageInsurerQuotePdfUrl ?? null,
      damageInsurerMailLog: this.parseDamageInsurerMailLog(row.serviceCase.damageInsurerMailLogJson),
      damageInspectionMode: row.serviceCase.damageInspectionMode ?? null,
      damageInspectionNotePdfUrl: row.serviceCase.damageInspectionNotePdfUrl ?? null,
      damageInspectionNoteFileName: row.serviceCase.damageInspectionNoteFileName ?? null,
      damageInspectionNoteIssuedOn: row.serviceCase.damageInspectionNoteIssuedOn
        ? row.serviceCase.damageInspectionNoteIssuedOn.toISOString().slice(0, 10)
        : null,
      damageInspectionNoteReceivedAt:
        row.serviceCase.damageInspectionNoteReceivedAt?.toISOString() ?? null,
      damageInspectionNoteNotes: row.serviceCase.damageInspectionNoteNotes ?? null,
      damageInspectionNotes: this.parseDamageInspectionNotes(
        row.serviceCase.damageInspectionNotesJson,
      ),
      damagePaymentAcceptancePdfUrl: row.serviceCase.damagePaymentAcceptancePdfUrl ?? null,
      damagePaymentAcceptanceFileName: row.serviceCase.damagePaymentAcceptanceFileName ?? null,
      damagePaymentAcceptanceReceivedAt:
        row.serviceCase.damagePaymentAcceptanceReceivedAt?.toISOString() ?? null,
      damagePaymentAcceptanceNotes: row.serviceCase.damagePaymentAcceptanceNotes ?? null,
      damagePaymentAcceptances: this.parseDamagePaymentAcceptances(
        row.serviceCase.damagePaymentAcceptancesJson,
        row.serviceCase,
      ),
      quoteSummary: primary
        ? {
            status: primary.status,
            version: primary.version,
            totalGrossCents:
              primary.approvedNetCents != null && primary.approvedVatCents != null
                ? primary.approvedNetCents + primary.approvedVatCents
                : primary.totalNetCents + primary.totalVatCents,
            currency: primary.currency,
            submittedAt: primary.submittedAt?.toISOString() ?? null,
            approvedAt: primary.approvedAt?.toISOString() ?? null,
            invoicedAt: primary.invoicedAt?.toISOString() ?? null,
          }
        : {
            status: null,
            version: null,
            totalGrossCents: null,
            currency: null,
            submittedAt: null,
            approvedAt: null,
            invoicedAt: null,
          },
    };
  }

  async patch(
    tenantSlug: string,
    id: string,
    dto: {
      serviceOrderType?: ServiceOrderType;
      estimatedRepairAt?: string | null;
      status?: MaintenanceWorkOrderStatus;
    },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderDetail> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        vehicle: { select: { clientId: true } },
        serviceCase: {
          select: {
            id: true,
            sourceTicketId: true,
            workflowType: true,
            damagePayerType: true,
            damageInsurerPipelineStatus: true,
            damageInsurerAgreedAt: true,
          },
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      try {
        this.assertWorkOrderWrite(access, wo);
      } catch {
        throw new ForbiddenException('Cannot update work order');
      }
    }

    const quoteLocked = await this.prisma.workOrderQuote.findFirst({
      where: {
        workOrderId: id,
        status: { in: [WorkOrderQuoteStatus.submitted, WorkOrderQuoteStatus.approved] },
      },
    });

    if (dto.serviceOrderType !== undefined) {
      if (quoteLocked) {
        throw new BadRequestException('Cannot change service order type after quote is submitted');
      }
    }

    if (dto.estimatedRepairAt !== undefined) {
      if (quoteLocked) {
        throw new BadRequestException('Cannot change estimated repair date after quote is submitted');
      }
    }

    if (
      dto.status === MaintenanceWorkOrderStatus.in_progress &&
      wo.status !== MaintenanceWorkOrderStatus.in_progress
    ) {
      await assertDamageReadyForRepair(this.prisma, tenant.id, {
        id: wo.serviceCase.id,
        workflowType: wo.serviceCase.workflowType,
        damagePayerType: wo.serviceCase.damagePayerType,
        damageInsurerPipelineStatus: wo.serviceCase.damageInsurerPipelineStatus,
        damageInsurerAgreedAt: wo.serviceCase.damageInsurerAgreedAt,
      });
    }

    const data: Prisma.MaintenanceWorkOrderUpdateInput = {};
    if (dto.serviceOrderType !== undefined) {
      data.serviceOrderType = dto.serviceOrderType;
    }
    if (dto.estimatedRepairAt !== undefined) {
      if (dto.estimatedRepairAt === null || dto.estimatedRepairAt === '') {
        data.estimatedRepairAt = null;
      } else {
        const parsed = new Date(dto.estimatedRepairAt);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('Invalid estimated repair date');
        }
        data.estimatedRepairAt = parsed;
      }
    }
    if (dto.status !== undefined) {
      if (!Object.values(MaintenanceWorkOrderStatus).includes(dto.status)) {
        throw new BadRequestException('Invalid status');
      }
      data.status = dto.status;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const estimatedChanged =
      dto.estimatedRepairAt !== undefined &&
      (dto.estimatedRepairAt
        ? new Date(dto.estimatedRepairAt).getTime()
        : null) !== (wo.estimatedRepairAt?.getTime() ?? null);

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceWorkOrder.update({ where: { id }, data });

      if (estimatedChanged && dto.estimatedRepairAt && wo.serviceCase.sourceTicketId) {
        const parsed = new Date(dto.estimatedRepairAt);
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: wo.serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `Estimare finalizare reparație: ${parsed.toLocaleDateString('ro-RO', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}.`,
            payload: {
              workOrderId: id,
              estimatedRepairAt: parsed.toISOString(),
              milestone: 'estimated_repair',
            },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order.patch',
      entityType: 'maintenance_work_order',
      entityId: id,
      meta: dto,
    });

    return this.getById(tenantSlug, id);
  }

  async markReady(
    tenantSlug: string,
    id: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderDetail> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        vehicle: { select: { clientId: true } },
        serviceCase: {
          select: {
            sourceTicketId: true,
            workflowType: true,
            damageInsurerPipelineStatus: true,
            damageInsurerAgreedAt: true,
          },
        },
        quotes: { where: { status: 'approved' }, take: 1 },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      try {
        this.assertWorkOrderWrite(access, wo);
      } catch {
        throw new ForbiddenException('Cannot mark work ready');
      }
    }
    if (wo.readyAt) {
      throw new BadRequestException('Work is already marked ready');
    }
    const damageApproved =
      wo.serviceCase.workflowType === 'damage' &&
      (wo.serviceCase.damageInsurerPipelineStatus === 'payment_accepted' ||
        !!wo.serviceCase.damageInsurerAgreedAt);
    if (!wo.quotes[0] && !damageApproved) {
      throw new BadRequestException(
        'Approved quote (or accept plată pe dosar daună) required before marking work ready',
      );
    }

    const readyAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceWorkOrder.update({
        where: { id },
        data: { readyAt },
      });

      const ticketId = wo.serviceCase.sourceTicketId;
      if (ticketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `Lucrare gata — reparație finalizată (${readyAt.toLocaleString('ro-RO')}).`,
            payload: { workOrderId: id, readyAt: readyAt.toISOString(), milestone: 'work_ready' },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order.mark_ready',
      entityType: 'maintenance_work_order',
      entityId: id,
      meta: { readyAt: readyAt.toISOString() },
    });

    return this.getById(tenantSlug, id);
  }

  /**
   * Etapă reparație suplimentară (omisiune / avarie ascunsă) — pe același WO,
   * după ce există un deviz aprobat v2+. Nu resetează Tila de la zero.
   */
  async startSupplementRepair(
    tenantSlug: string,
    id: string,
    dto: { note?: string | null } = {},
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderDetail> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        vehicle: { select: { clientId: true } },
        serviceCase: { select: { sourceTicketId: true, workflowType: true } },
        quotes: {
          where: { status: WorkOrderQuoteStatus.approved },
          orderBy: { version: 'desc' },
          take: 5,
          select: { version: true },
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      try {
        this.assertWorkOrderWrite(access, wo);
      } catch {
        throw new ForbiddenException('Cannot start supplement repair');
      }
    }
    if (!wo.inServiceAt) {
      throw new BadRequestException(
        'Mașina trebuie să fie In service pentru o etapă suplimentară pe aceeași comandă',
      );
    }
    if (wo.outServiceAt && !wo.visit2InServiceAt) {
      throw new BadRequestException(
        'Mașina a ieșit din service — folosește reprogramare / vizita 2, nu etapă pe Tila curentă',
      );
    }
    const topQuote = wo.quotes[0];
    if (!topQuote || topQuote.version < 2) {
      throw new BadRequestException(
        'Este nevoie de un Deviz aprobat v2+ (supliment) înainte de etapa suplimentară',
      );
    }
    if (wo.supplementRepairAt && !wo.readyAt) {
      throw new BadRequestException('Există deja o etapă suplimentară activă');
    }

    const note = dto.note?.trim();
    const noteLine = `Etapă suplimentară (deviz v${topQuote.version})${note ? `: ${note}` : ''}`;
    const prevNote = wo.repairPathNote?.trim();
    const at = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceWorkOrder.update({
        where: { id },
        data: {
          readyAt: null,
          status: MaintenanceWorkOrderStatus.in_progress,
          supplementRepairAt: at,
          supplementQuoteVersion: topQuote.version,
          repairPathNote: prevNote ? `${prevNote}\n${noteLine}` : noteLine,
        },
      });
      const ticketId = wo.serviceCase.sourceTicketId;
      if (ticketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `${noteLine} — ${at.toLocaleString('ro-RO')}.`,
            payload: {
              workOrderId: id,
              supplementQuoteVersion: topQuote.version,
              milestone: 'supplement_repair',
            },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order.start_supplement_repair',
      entityType: 'maintenance_work_order',
      entityId: id,
      meta: { quoteVersion: topQuote.version },
    });

    return this.getById(tenantSlug, id);
  }

  async recordServiceTimes(
    tenantSlug: string,
    id: string,
    dto: {
      inServiceAt?: string | null;
      outServiceAt?: string | null;
      odometerKmIn?: number | null;
      odometerKmOut?: number | null;
    },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceTimesResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, workOrderSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const settings = parseWorkOrderSettings(tenant.workOrderSettings);

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        vehicle: { select: { id: true, clientId: true, odometerKm: true } },
        serviceCase: {
          select: {
            id: true,
            currentStage: true,
            sourceTicketId: true,
            clientId: true,
            postApprovalPath: true,
            workflowType: true,
            vehicleMovable: true,
            damagePayerType: true,
            damageInsurerPipelineStatus: true,
            damageInsurerAgreedAt: true,
          },
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      try {
        this.assertWorkOrderWrite(access, wo);
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
        throw new ForbiddenException(
          isPartnerUser(access)
            ? 'Partenerul nu poate marca recepția pe această comandă'
            : 'Cannot update service times',
        );
      }
    }

    const data: {
      inServiceAt?: Date | null;
      outServiceAt?: Date | null;
      visit2InServiceAt?: Date | null;
      visit2OutServiceAt?: Date | null;
      odometerKmIn?: number | null;
      odometerKmOut?: number | null;
      visit2OdometerKmIn?: number | null;
      visit2OdometerKmOut?: number | null;
      status?: MaintenanceWorkOrderStatus;
    } = {};
    const useVisit2 = wo.serviceCase.postApprovalPath === 'reschedule' && !!wo.outServiceAt;

    if (dto.inServiceAt !== undefined) {
      if (dto.inServiceAt === null || dto.inServiceAt === '') {
        if (useVisit2) data.visit2InServiceAt = null;
        else data.inServiceAt = null;
      } else {
        const d = new Date(dto.inServiceAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid inServiceAt');
        if (useVisit2) data.visit2InServiceAt = d;
        else data.inServiceAt = d;
      }
    }

    if (dto.outServiceAt !== undefined) {
      if (dto.outServiceAt === null || dto.outServiceAt === '') {
        if (useVisit2) data.visit2OutServiceAt = null;
        else data.outServiceAt = null;
      } else {
        const d = new Date(dto.outServiceAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid outServiceAt');
        if (useVisit2) data.visit2OutServiceAt = d;
        else data.outServiceAt = d;
      }
    }

    if (dto.odometerKmIn !== undefined) {
      if (dto.odometerKmIn === null) {
        if (useVisit2) data.visit2OdometerKmIn = null;
        else data.odometerKmIn = null;
      } else if (!Number.isFinite(dto.odometerKmIn) || dto.odometerKmIn < 0) {
        throw new BadRequestException('odometerKmIn must be a non-negative integer');
      } else {
        if (useVisit2) data.visit2OdometerKmIn = Math.round(dto.odometerKmIn);
        else data.odometerKmIn = Math.round(dto.odometerKmIn);
      }
    }

    if (dto.odometerKmOut !== undefined) {
      if (dto.odometerKmOut === null) {
        if (useVisit2) data.visit2OdometerKmOut = null;
        else data.odometerKmOut = null;
      } else if (!Number.isFinite(dto.odometerKmOut) || dto.odometerKmOut < 0) {
        throw new BadRequestException('odometerKmOut must be a non-negative integer');
      } else {
        if (useVisit2) data.visit2OdometerKmOut = Math.round(dto.odometerKmOut);
        else data.odometerKmOut = Math.round(dto.odometerKmOut);
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide inServiceAt, outServiceAt, and/or odometer fields');
    }

    const nextIn = useVisit2
      ? data.visit2InServiceAt !== undefined
        ? data.visit2InServiceAt
        : wo.visit2InServiceAt
      : data.inServiceAt !== undefined
        ? data.inServiceAt
        : wo.inServiceAt;
    const nextOut = useVisit2
      ? data.visit2OutServiceAt !== undefined
        ? data.visit2OutServiceAt
        : wo.visit2OutServiceAt
      : data.outServiceAt !== undefined
        ? data.outServiceAt
        : wo.outServiceAt;
    const nextKmIn = useVisit2
      ? data.visit2OdometerKmIn !== undefined
        ? data.visit2OdometerKmIn
        : wo.visit2OdometerKmIn
      : data.odometerKmIn !== undefined
        ? data.odometerKmIn
        : wo.odometerKmIn;
    const nextKmOut = useVisit2
      ? data.visit2OdometerKmOut !== undefined
        ? data.visit2OdometerKmOut
        : wo.visit2OdometerKmOut
      : data.odometerKmOut !== undefined
        ? data.odometerKmOut
        : wo.odometerKmOut;

    if (nextIn && nextOut && nextOut.getTime() < nextIn.getTime()) {
      throw new BadRequestException('outServiceAt must be after inServiceAt');
    }

    const markingIn = useVisit2
      ? data.visit2InServiceAt != null && !wo.visit2InServiceAt
      : data.inServiceAt != null && !wo.inServiceAt;
    const markingOut = useVisit2
      ? data.visit2OutServiceAt != null && !wo.visit2OutServiceAt
      : data.outServiceAt != null && !wo.outServiceAt;

    if (markingIn) {
      const sc = wo.serviceCase;
      const isDamage = sc.workflowType === ServiceCaseWorkflowType.damage;

      // Recepție (In service): doar roadside pentru imobil.
      // Gate-ul Accept plată + mobilitate se aplică la start reparație (În lucru), nu aici.
      await assertImmovableRoadsideForReception(
        this.prisma,
        tenant.id,
        sc.id,
        sc.vehicleMovable,
      );

      // Vizită 2 = start reparație după reprogramare → gate reparație.
      if (useVisit2 && isDamage) {
        await assertDamageReadyForRepair(this.prisma, tenant.id, {
          id: sc.id,
          workflowType: sc.workflowType,
          damagePayerType: sc.damagePayerType,
          damageInsurerPipelineStatus: sc.damageInsurerPipelineStatus,
          damageInsurerAgreedAt: sc.damageInsurerAgreedAt,
        });
      }
    }

    if (settings.requireServiceKm) {
      if (markingIn && (nextKmIn == null || nextKmIn < 0)) {
        throw new BadRequestException('Km intrare este obligatoriu (setare WO)');
      }
      if (markingOut && (nextKmOut == null || nextKmOut < 0)) {
        throw new BadRequestException('Km ieșire este obligatoriu (setare WO)');
      }
    }

    if (nextKmIn != null && nextKmOut != null && nextKmOut < nextKmIn) {
      throw new BadRequestException('Km ieșire trebuie să fie ≥ km intrare');
    }

    if (data.inServiceAt || data.visit2InServiceAt) {
      const isDamage = wo.serviceCase.workflowType === ServiceCaseWorkflowType.damage;
      // Pe daună, recepția (vizită 1) nu trece automat în „În lucru” — asta e după Accept plată / post-approval.
      const promoteToInProgress = useVisit2 || !isDamage;
      if (
        promoteToInProgress &&
        (wo.status === MaintenanceWorkOrderStatus.draft ||
          wo.status === MaintenanceWorkOrderStatus.sent ||
          wo.status === MaintenanceWorkOrderStatus.waiting_parts)
      ) {
        data.status = MaintenanceWorkOrderStatus.in_progress;
      }
    }

    const fleetKmCandidates: { km: number; phase: 'in' | 'out' | 'visit2_in' | 'visit2_out' }[] = [];
    if (settings.updateFleetOdometerFromServiceKm) {
      if (markingIn && nextKmIn != null) fleetKmCandidates.push({ km: nextKmIn, phase: useVisit2 ? 'visit2_in' : 'in' });
      if (markingOut && nextKmOut != null) fleetKmCandidates.push({ km: nextKmOut, phase: useVisit2 ? 'visit2_out' : 'out' });
      if (!markingIn && !markingOut) {
        if (data.odometerKmIn != null) fleetKmCandidates.push({ km: data.odometerKmIn, phase: 'in' });
        if (data.odometerKmOut != null) fleetKmCandidates.push({ km: data.odometerKmOut, phase: 'out' });
        if (data.visit2OdometerKmIn != null) fleetKmCandidates.push({ km: data.visit2OdometerKmIn, phase: 'visit2_in' });
        if (data.visit2OdometerKmOut != null) fleetKmCandidates.push({ km: data.visit2OdometerKmOut, phase: 'visit2_out' });
      }
    }

    const previousFleetKm = wo.vehicle.odometerKm;
    let fleetUpdatedTo: number | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceWorkOrder.update({ where: { id }, data });

      const ticketId = wo.serviceCase.sourceTicketId;
      const inEventAt = data.inServiceAt ?? data.visit2InServiceAt;
      const outEventAt = data.outServiceAt ?? data.visit2OutServiceAt;
      if (inEventAt) {
        await this.ensureCaseStageAtLeast(
          tx,
          tenant.id,
          wo.serviceCaseId,
          ServiceCaseStage.in_service,
          ticketId,
          actorUserId,
          `${useVisit2 ? 'Intrare service vizita 2' : 'Intrare service'}: ${inEventAt.toLocaleString('ro-RO')}.`,
        );
      }
      if (outEventAt) {
        await this.ensureCaseStageAtLeast(
          tx,
          tenant.id,
          wo.serviceCaseId,
          ServiceCaseStage.out_service,
          ticketId,
          actorUserId,
          `${useVisit2 ? 'Ieșire service vizita 2' : 'Ieșire service'}: ${outEventAt.toLocaleString('ro-RO')}.`,
        );
        await tx.workOrderWarranty.updateMany({
          where: { tenantId: tenant.id, workOrderId: id, status: WorkOrderWarrantyStatus.draft },
          data: {
            status: WorkOrderWarrantyStatus.active,
            startsAt: outEventAt,
            startsKm: nextKmOut ?? null,
          },
        });
      }

      let currentFleetKm = previousFleetKm;
      for (const cand of fleetKmCandidates) {
        if (cand.km < currentFleetKm) continue;
        await tx.odometerReading.create({
          data: {
            vehicleId: wo.vehicle.id,
            odometerKm: cand.km,
            source: 'ops',
            sourceRef: `work_order:${id}:${cand.phase}`,
            notes:
              cand.phase === 'in'
                ? 'Km la intrare service (comandă)'
                : cand.phase === 'out'
                  ? 'Km la ieșire service (comandă)'
                  : cand.phase === 'visit2_in'
                    ? 'Km la intrare service vizita 2 (comandă)'
                    : 'Km la ieșire service vizita 2 (comandă)',
            recordedByUserId: actorUserId ?? null,
          },
        });
        await tx.vehicle.update({
          where: { id: wo.vehicle.id },
          data: {
            odometerKm: cand.km,
            updatedByUserId: actorUserId ?? undefined,
          },
        });
        currentFleetKm = cand.km;
        fleetUpdatedTo = cand.km;
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order.service_times',
      entityType: 'maintenance_work_order',
      entityId: id,
      meta: {
        inServiceAt: nextIn?.toISOString(),
        outServiceAt: nextOut?.toISOString(),
        odometerKmIn: nextKmIn,
        odometerKmOut: nextKmOut,
        requireServiceKm: settings.requireServiceKm,
        updateFleetOdometer: settings.updateFleetOdometerFromServiceKm,
        fleetOdometerUpdated: fleetUpdatedTo != null,
        fleetOdometerPreviousKm: previousFleetKm,
        fleetOdometerNewKm: fleetUpdatedTo,
      },
    });

    const detail = await this.getById(tenantSlug, id);
    return {
      ...detail,
      fleetOdometerUpdate: {
        updated: fleetUpdatedTo != null,
        previousKm: previousFleetKm,
        newKm: fleetUpdatedTo,
      },
    };
  }

  private async ensureCaseStageAtLeast(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceCaseId: string,
    targetStage: ServiceCaseStage,
    sourceTicketId: string | null,
    actorUserId?: string,
    eventBody?: string,
  ) {
    const serviceCase = await tx.serviceCase.findFirst({ where: { id: serviceCaseId, tenantId } });
    if (!serviceCase) return;

    const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(serviceCase.currentStage);
    const targetIdx = SERVICE_CASE_STAGE_ORDER.indexOf(targetStage);
    if (targetIdx <= currentIdx) return;

    await tx.serviceCase.update({
      where: { id: serviceCaseId },
      data: { currentStage: targetStage },
    });

    if (sourceTicketId) {
      await tx.crmTicketEvent.create({
        data: {
          tenantId,
          ticketId: sourceTicketId,
          kind: CrmTicketEventKind.workflow_advance,
          body: eventBody ?? `Dosar avansat la etapa ${targetStage}.`,
          payload: { fromStage: serviceCase.currentStage, toStage: targetStage, serviceCaseId },
          actorUserId: actorUserId ?? null,
        },
      });
    }
  }

  private async resolveLinkedAppointment(
    tenantId: string,
    serviceCaseId: string,
    plannedAt: Date | null,
  ): Promise<{ id: string; scheduledAt: Date; status: string } | null> {
    const rows = await this.prisma.serviceAppointment.findMany({
      where: {
        tenantId,
        serviceCaseId,
        status: { not: 'cancelled' },
      },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true, scheduledAt: true, status: true },
      take: 12,
    });
    if (!rows.length) return null;

    const active = rows.find((r) =>
      ['pending_supplier', 'needs_repropose', 'scheduled', 'confirmed'].includes(r.status),
    );
    if (active) return active;

    if (plannedAt) {
      const exact = rows.find((r) => r.scheduledAt.getTime() === plannedAt.getTime());
      if (exact) return exact;
    }

    return rows[0] ?? null;
  }

  private async resolveTicketSettlement(
    tenantId: string,
    sourceTicketId: string | null,
  ): Promise<WorkOrderTicketSettlement | null> {
    if (!sourceTicketId) return null;
    const link = await this.prisma.crmTicketLink.findFirst({
      where: {
        tenantId,
        ticketId: sourceTicketId,
        entityType: {
          in: [
            CrmTicketLinkEntityType.maintenance,
            CrmTicketLinkEntityType.cost,
            CrmTicketLinkEntityType.document,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { entityType: true, entityId: true, createdAt: true },
    });
    if (!link) return null;
    if (
      link.entityType !== CrmTicketLinkEntityType.maintenance &&
      link.entityType !== CrmTicketLinkEntityType.cost &&
      link.entityType !== CrmTicketLinkEntityType.document
    ) {
      return null;
    }
    return {
      entityType: link.entityType,
      entityId: link.entityId,
      createdAt: link.createdAt.toISOString(),
    };
  }

  private outServiceDone(wo: {
    outServiceAt: Date | null;
    visit2OutServiceAt: Date | null;
    postApprovalPath?: string | null;
  }): boolean {
    if (wo.postApprovalPath === 'reschedule') {
      return !!wo.visit2OutServiceAt || !!wo.outServiceAt;
    }
    return !!wo.outServiceAt;
  }

  async complete(tenantSlug: string, id: string, actorUserId?: string, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        vehicle: { select: { clientId: true } },
        serviceCase: true,
        quotes: {
          where: { status: 'approved' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      try {
        this.assertWorkOrderWrite(access, wo);
      } catch {
        throw new ForbiddenException('Cannot complete work order');
      }
    }

    const partner = !!(access && isPartnerUser(access));
    const approvedQuote = wo.quotes[0];
    const outDone = this.outServiceDone({
      outServiceAt: wo.outServiceAt,
      visit2OutServiceAt: wo.visit2OutServiceAt,
      postApprovalPath: wo.serviceCase.postApprovalPath,
    });

    if (partner) {
      if (wo.status === MaintenanceWorkOrderStatus.done) {
        throw new BadRequestException('Comanda este deja finalizată');
      }
      if (wo.status === MaintenanceWorkOrderStatus.cancelled) {
        throw new BadRequestException('Comanda anulată nu poate fi finalizată');
      }
      if (!outDone) {
        throw new BadRequestException('Marcați Out service înainte de a închide comanda');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.maintenanceWorkOrder.update({
          where: { id },
          data: {
            status: MaintenanceWorkOrderStatus.done,
            completedAt: new Date(),
            repairPathNote: wo.repairPathNote?.trim()
              ? wo.repairPathNote
              : 'Finalizată de partener (lucrare gata)',
          },
        });

        if (wo.serviceCase.sourceTicketId) {
          await tx.crmTicketEvent.create({
            data: {
              tenantId: tenant.id,
              ticketId: wo.serviceCase.sourceTicketId,
              kind: CrmTicketEventKind.workflow_advance,
              body: 'Partenerul a marcat comanda finalizată (lucrare gata). Dosarul rămâne deschis până la evidența flotă.',
              payload: {
                workOrderId: id,
                serviceCaseId: wo.serviceCaseId,
                completedBy: 'partner',
              },
              actorUserId: actorUserId ?? null,
            },
          });
        }
      });

      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: 'work_order.complete_partner',
        entityType: 'maintenance_work_order',
        entityId: id,
        meta: { serviceCaseId: wo.serviceCaseId },
      });

      return this.getById(tenantSlug, id, access);
    }

    // Flotă: închide WO (dacă e nevoie) + dosar + tichet când există evidență.
    const ticketSettlement = await this.resolveTicketSettlement(
      tenant.id,
      wo.serviceCase.sourceTicketId,
    );
    const hasSettlement = !!approvedQuote?.costEntryId || !!ticketSettlement;

    if (!hasSettlement) {
      throw new BadRequestException(
        'Înainte de închiderea dosarului: generați cost din deviz sau transformați reparația în mentenanță / cost / document din Acțiuni.',
      );
    }

    if (wo.status === MaintenanceWorkOrderStatus.cancelled) {
      throw new BadRequestException('Comanda anulată nu poate fi finalizată');
    }

    const caseAlreadyClosed =
      wo.serviceCase.status === ServiceCaseStatus.completed ||
      wo.serviceCase.currentStage === ServiceCaseStage.closed;

    if (wo.status === MaintenanceWorkOrderStatus.done && caseAlreadyClosed) {
      throw new BadRequestException('Comanda și dosarul sunt deja închise');
    }

    if (wo.status !== MaintenanceWorkOrderStatus.done && !outDone) {
      throw new BadRequestException('Marcați Out service înainte de a închide comanda');
    }

    await this.prisma.$transaction(async (tx) => {
      if (wo.status !== MaintenanceWorkOrderStatus.done) {
        await tx.maintenanceWorkOrder.update({
          where: { id },
          data: {
            status: MaintenanceWorkOrderStatus.done,
            completedAt: new Date(),
          },
        });
      }

      if (!caseAlreadyClosed) {
        await tx.serviceCase.update({
          where: { id: wo.serviceCaseId },
          data: {
            currentStage: ServiceCaseStage.closed,
            status: ServiceCaseStatus.completed,
            closedAt: new Date(),
          },
        });
      }

      if (wo.serviceCase.sourceTicketId) {
        const ticket = await tx.crmTicket.findFirst({
          where: { id: wo.serviceCase.sourceTicketId, tenantId: tenant.id },
        });
        if (
          ticket &&
          ticket.status !== CrmTicketStatus.resolved &&
          ticket.status !== CrmTicketStatus.cancelled
        ) {
          await tx.crmTicket.update({
            where: { id: ticket.id },
            data: {
              status: CrmTicketStatus.resolved,
              resolvedAt: new Date(),
            },
          });
          await tx.crmTicketEvent.create({
            data: {
              tenantId: tenant.id,
              ticketId: ticket.id,
              kind: CrmTicketEventKind.status,
              body: 'Tichet rezolvat — comandă service finalizată (evidență cost/mentenanță/document).',
              payload: {
                status: 'resolved',
                auto: true,
                workOrderId: id,
                settlement: ticketSettlement?.entityType ?? (approvedQuote?.costEntryId ? 'quote_cost' : null),
              },
              actorUserId: actorUserId ?? null,
            },
          });
        }
        if (!caseAlreadyClosed) {
          await tx.crmTicketEvent.create({
            data: {
              tenantId: tenant.id,
              ticketId: wo.serviceCase.sourceTicketId,
              kind: CrmTicketEventKind.workflow_advance,
              body: 'Comandă service finalizată — dosar închis.',
              payload: {
                fromStage: wo.serviceCase.currentStage,
                toStage: ServiceCaseStage.closed,
                serviceCaseId: wo.serviceCaseId,
                workOrderId: id,
                completedBy: 'fleet',
              },
              actorUserId: actorUserId ?? null,
            },
          });
        }
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order.complete',
      entityType: 'maintenance_work_order',
      entityId: id,
      meta: {
        serviceCaseId: wo.serviceCaseId,
        settlement: ticketSettlement?.entityType ?? (approvedQuote?.costEntryId ? 'quote_cost' : null),
      },
    });

    return this.getById(tenantSlug, id, access);
  }

  private parseDamageDocuments(raw: unknown): DamageDocumentItem[] {
    if (!Array.isArray(raw)) return [];
    const out: DamageDocumentItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.kind !== 'string') continue;
      out.push({
        id: o.id,
        kind: o.kind,
        label: typeof o.label === 'string' ? o.label : undefined,
        notes: typeof o.notes === 'string' ? o.notes : undefined,
        received: o.received === true,
        uploadedAt: typeof o.uploadedAt === 'string' ? o.uploadedAt : new Date(0).toISOString(),
        uploadedByLabel: typeof o.uploadedByLabel === 'string' ? o.uploadedByLabel : undefined,
        url: typeof o.url === 'string' ? o.url : undefined,
        fileName: typeof o.fileName === 'string' ? o.fileName : undefined,
        expiresOn: typeof o.expiresOn === 'string' ? o.expiresOn : undefined,
      });
    }
    return out;
  }

  private parseDamageInspectionNotes(raw: unknown): WorkOrderDetail['damageInspectionNotes'] {
    if (!Array.isArray(raw)) return [];
    const out: WorkOrderDetail['damageInspectionNotes'] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (o.kind === 'reinspection_request') {
        if (typeof o.id !== 'string' || typeof o.sentAt !== 'string') continue;
        const status =
          o.status === 'approved' || o.status === 'rejected' || o.status === 'pending'
            ? o.status
            : 'pending';
        out.push({
          id: o.id,
          kind: 'reinspection_request',
          sequence: typeof o.sequence === 'number' && o.sequence > 0 ? o.sequence : out.length + 1,
          status,
          explanation: typeof o.explanation === 'string' ? o.explanation : '',
          photoIds: Array.isArray(o.photoIds)
            ? o.photoIds.filter((x): x is string => typeof x === 'string')
            : [],
          sentAt: o.sentAt,
          decidedAt: typeof o.decidedAt === 'string' ? o.decidedAt : undefined,
          rejectionReason: typeof o.rejectionReason === 'string' ? o.rejectionReason : undefined,
          approvalDocUrl: typeof o.approvalDocUrl === 'string' ? o.approvalDocUrl : undefined,
          approvalDocFileName:
            typeof o.approvalDocFileName === 'string' ? o.approvalDocFileName : undefined,
          linkedPvsId: typeof o.linkedPvsId === 'string' ? o.linkedPvsId : undefined,
          mailLogId: typeof o.mailLogId === 'string' ? o.mailLogId : undefined,
        });
        continue;
      }
      if (typeof o.id !== 'string' || typeof o.pdfUrl !== 'string' || typeof o.receivedAt !== 'string') {
        continue;
      }
      out.push({
        id: o.id,
        kind: o.kind === 'pvs' ? 'pvs' : 'inspection_note',
        sequence: typeof o.sequence === 'number' ? o.sequence : undefined,
        requestId: typeof o.requestId === 'string' ? o.requestId : undefined,
        pdfUrl: o.pdfUrl,
        fileName: typeof o.fileName === 'string' ? o.fileName : undefined,
        mode: o.mode === 'photos' || o.mode === 'on_site' ? o.mode : null,
        issuedOn: typeof o.issuedOn === 'string' ? o.issuedOn : null,
        receivedAt: o.receivedAt,
        notes: typeof o.notes === 'string' ? o.notes : null,
      });
    }
    return out;
  }

  private parseDamagePaymentAcceptances(
    raw: unknown,
    sc: {
      id: string;
      damagePaymentAcceptancePdfUrl: string | null;
      damagePaymentAcceptanceFileName: string | null;
      damagePaymentAcceptanceReceivedAt: Date | null;
      damagePaymentAcceptanceNotes: string | null;
      createdAt: Date;
    },
  ): WorkOrderDetail['damagePaymentAcceptances'] {
    if (Array.isArray(raw)) {
      const out: WorkOrderDetail['damagePaymentAcceptances'] = [];
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        if (typeof o.id !== 'string' || typeof o.pdfUrl !== 'string') continue;
        if (typeof o.receivedAt !== 'string') continue;
        out.push({
          id: o.id,
          sequence: typeof o.sequence === 'number' && o.sequence > 0 ? o.sequence : out.length + 1,
          pdfUrl: o.pdfUrl,
          fileName: typeof o.fileName === 'string' ? o.fileName : undefined,
          receivedAt: o.receivedAt,
          notes: typeof o.notes === 'string' ? o.notes : null,
        });
      }
      if (out.length) return out.sort((a, b) => b.sequence - a.sequence);
    }
    if (sc.damagePaymentAcceptancePdfUrl?.trim()) {
      return [
        {
          id: `accept_legacy_${sc.id.slice(-8)}`,
          sequence: 1,
          pdfUrl: sc.damagePaymentAcceptancePdfUrl.trim(),
          fileName: sc.damagePaymentAcceptanceFileName ?? undefined,
          receivedAt:
            sc.damagePaymentAcceptanceReceivedAt?.toISOString() ?? sc.createdAt.toISOString(),
          notes: sc.damagePaymentAcceptanceNotes ?? null,
        },
      ];
    }
    return [];
  }

  private parseDamagePhotos(raw: unknown): DamagePhotoItem[] {
    if (!Array.isArray(raw)) return [];
    const out: DamagePhotoItem[] = [];
    const kinds = new Set(['exterior', 'damage_detail', 'odometer', 'repaired', 'other']);
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.url !== 'string') continue;
      const kind = typeof o.kind === 'string' && kinds.has(o.kind) ? o.kind : 'other';
      out.push({
        id: o.id,
        url: o.url,
        kind: kind as DamagePhotoItem['kind'],
        caption: typeof o.caption === 'string' ? o.caption : undefined,
        uploadedAt: typeof o.uploadedAt === 'string' ? o.uploadedAt : new Date(0).toISOString(),
        uploadedByUserId: typeof o.uploadedByUserId === 'string' ? o.uploadedByUserId : undefined,
        uploadedByLabel: typeof o.uploadedByLabel === 'string' ? o.uploadedByLabel : undefined,
      });
    }
    return out;
  }

  private parseDamageInsurerMailLog(raw: unknown): DamageInsurerMailLogItem[] {
    if (!Array.isArray(raw)) return [];
    const out: DamageInsurerMailLogItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.at !== 'string' || typeof o.to !== 'string') continue;
      if (typeof o.subject !== 'string') continue;
      const status =
        o.status === 'sent' || o.status === 'stubbed' || o.status === 'failed' ? o.status : 'stubbed';
      out.push({
        id: o.id,
        at: o.at,
        direction: o.direction === 'inbound_note' ? 'inbound_note' : 'outbound',
        to: o.to,
        subject: o.subject,
        status,
        kind:
          o.kind === 'avizare' || o.kind === 'quote' || o.kind === 'reinspection'
            ? o.kind
            : undefined,
        quoteId: typeof o.quoteId === 'string' ? o.quoteId : undefined,
        note: typeof o.note === 'string' ? o.note : undefined,
        pdfUrl: typeof o.pdfUrl === 'string' ? o.pdfUrl : undefined,
        attachmentUrls: Array.isArray(o.attachmentUrls)
          ? o.attachmentUrls.filter((u): u is string => typeof u === 'string')
          : undefined,
        error: typeof o.error === 'string' ? o.error : undefined,
      });
    }
    return out;
  }

  private parseDamageSectionLocks(raw: unknown): DamageSectionLocks {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const keys = ['claim_info', 'documents', 'photos', 'pipeline'] as const;
    const out: DamageSectionLocks = {};
    for (const key of keys) {
      const entry = (raw as Record<string, unknown>)[key];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const o = entry as Record<string, unknown>;
      if (typeof o.lockedByUserId !== 'string' || typeof o.lockedAt !== 'string') continue;
      out[key] = {
        lockedByUserId: o.lockedByUserId,
        lockedByLabel: typeof o.lockedByLabel === 'string' ? o.lockedByLabel : undefined,
        lockedAt: o.lockedAt,
      };
    }
    return out;
  }
}
