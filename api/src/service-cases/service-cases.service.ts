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
  CrmTicketType,
  DamageClaimStatus,
  DamageInsuranceType,
  DamageInspectionMode,
  DamageInsurerPipelineStatus,
  DamagePayerType,
  DamageQuoteOrigin,
  MaintenanceWorkOrderStatus,
  MembershipRole,
  Prisma,
  RoadsideInterventionKind,
  RoadsideInterventionStatus,
  ServiceAppointmentStatus,
  ServiceAppointmentProposedBy,
  ServiceCaseSourceType,
  ServiceCaseStage,
  ServiceCaseStatus,
  ServiceCaseWorkflowType,
  ServiceOrderType,
  PostApprovalPath,
  VehicleMovableState,
  WorkOrderQuoteLineApproval,
  WorkOrderQuoteLineType,
  WorkOrderQuoteStatus,
} from '@prisma/client';
import { PartnerNotificationService } from '../partner/partner-notification.service';
import { PartnerMailService } from '../partner/partner-mail.service';
import { parseTenantMailSettings } from '../tenant/mail-settings';
import { parseClientMailSettings } from '../clients/client-mail-settings';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertClientAccess,
  assertServiceCaseWrite,
  canAckAppointmentAsDriver,
  canConfirmAppointment,
  canReadTicket,
  isTenantWideAccess,
} from '../iam/client-access';
import { assertPartnerSupplierId, assertPartnerWrite, isPartnerUser, allowedSupplierIds } from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';
import { nextWorkOrderDisplayNumber } from '../work-orders/work-order-display-number';
import { nextRoadsideDisplayNumber } from '../roadside/roadside-display-number';
import { resolveSupplierInTenant } from '../suppliers/supplier-resolve';
import { assertDamageReadyForRepair } from '../work-orders/damage-repair-gates';
import {
  proposedByFromAccess,
  resolveInitialAppointmentStatus,
} from '../appointments/appointment-status.utils';

export const SERVICE_CASE_STAGE_ORDER: ServiceCaseStage[] = [
  ServiceCaseStage.intake,
  ServiceCaseStage.scheduled,
  ServiceCaseStage.work_order,
  ServiceCaseStage.in_service,
  ServiceCaseStage.out_service,
  ServiceCaseStage.quote,
  ServiceCaseStage.approval,
  ServiceCaseStage.invoiced,
  ServiceCaseStage.cost,
  ServiceCaseStage.closed,
];

export type WorkOrderRecord = {
  id: string;
  serviceCaseId: string;
  vehicleId: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  status: MaintenanceWorkOrderStatus;
  plannedAt: string | null;
  completedAt: string | null;
  inServiceAt: string | null;
  outServiceAt: string | null;
  displayNumber: string | null;
  odometerKmIn: number | null;
  odometerKmOut: number | null;
  repairPathNote: string | null;
  serviceOrderType: string;
  readyAt: string | null;
  estimatedRepairAt: string | null;
  createdAt: string;
  latestQuote: QuoteSummary | null;
  approvedQuote: QuoteSummary | null;
  pendingQuote: QuoteSummary | null;
};

export type QuoteSummary = {
  id: string;
  workOrderId: string;
  version: number;
  status: WorkOrderQuoteStatus;
  totalGrossCents: number;
  currency: string;
  invoicedAt: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  costEntryId: string | null;
};

export type ServiceAppointmentRecord = {
  id: string;
  serviceCaseId: string;
  vehicleId: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  scheduledAt: string;
  endAt: string;
  durationMin: number;
  location: string | null;
  status: ServiceAppointmentStatus;
  proposedByRole: ServiceAppointmentProposedBy | null;
  supplierValidatedAt: string | null;
  cancellationRequestedAt: string | null;
  cancellationRequestNote: string | null;
  notes: string | null;
  managerConfirmedAt: string | null;
  driverAcknowledgedAt: string | null;
  driverDeclinedAt: string | null;
  driverDeclineNote: string | null;
  lastProposalNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateServiceAppointmentInput = {
  scheduledAt: string;
  supplierId?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: ServiceAppointmentStatus;
  title?: string | null;
  durationMin?: number;
  /** Programare directă de furnizor — fără pending_supplier. */
  createdBySupplier?: boolean;
};

export type SupplierValidateAppointmentInput = {
  scheduledAt?: string;
  durationMin?: number;
  notes?: string | null;
};

export type DeclineAppointmentInput = {
  note: string;
};

export type ReproposeAppointmentInput = {
  scheduledAt: string;
  durationMin?: number;
  note?: string | null;
};

export type RequestCancelAppointmentInput = {
  note?: string | null;
};

export type UpdateServiceAppointmentInput = {
  scheduledAt?: string;
  supplierId?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: ServiceAppointmentStatus;
};

export type DamageDocumentItem = {
  id: string;
  kind: string;
  label?: string;
  notes?: string;
  received: boolean;
  uploadedAt: string;
  uploadedByLabel?: string;
  /** Fișier scanat / PDF (opțional). */
  url?: string;
  fileName?: string;
  /** YYYY-MM-DD — ex. expirare ITP (poate exista fără fișier). */
  expiresOn?: string;
};

export type DamagePhotoItem = {
  id: string;
  url: string;
  kind: 'exterior' | 'damage_detail' | 'odometer' | 'repaired' | 'other';
  caption?: string;
  uploadedAt: string;
  uploadedByUserId?: string;
  uploadedByLabel?: string;
};

export type DamageReinspectionRequestStatus = 'pending' | 'approved' | 'rejected';

/** Notă constatare sau PVS (document PDF pe istoric). */
export type DamageInspectionNoteItem = {
  id: string;
  /** Lipsă / inspection_note = notă inițială; pvs = Proces Verbal Suplimentar. */
  kind?: 'inspection_note' | 'pvs';
  /** Număr PVS (1, 2, …) — doar pentru kind=pvs. */
  sequence?: number;
  /** Cererea de reconstatare legată (la PVS). */
  requestId?: string;
  pdfUrl: string;
  fileName?: string;
  mode?: DamageInspectionMode | null;
  issuedOn?: string | null;
  receivedAt: string;
  notes?: string | null;
};

/** Solicitare reconstatare — poate fi aprobată sau respinsă de asigurător. */
export type DamageReinspectionRequestItem = {
  id: string;
  kind: 'reinspection_request';
  sequence: number;
  status: DamageReinspectionRequestStatus;
  explanation: string;
  photoIds: string[];
  sentAt: string;
  decidedAt?: string;
  rejectionReason?: string;
  /** Document de aprobare / PVS de la asigurător (la approved). */
  approvalDocUrl?: string;
  approvalDocFileName?: string;
  linkedPvsId?: string;
  mailLogId?: string;
};

export type DamageConstatareHistoryItem =
  | DamageInspectionNoteItem
  | DamageReinspectionRequestItem;

/** Accept plată pe istoric (Accept 1, 2, …). */
export type DamagePaymentAcceptanceItem = {
  id: string;
  sequence: number;
  pdfUrl: string;
  fileName?: string;
  receivedAt: string;
  notes?: string | null;
};

export type DamageSectionKey = 'claim_info' | 'documents' | 'photos' | 'pipeline';

export type DamageSectionLock = {
  lockedByUserId: string;
  lockedByLabel?: string;
  lockedAt: string;
};

export type DamageSectionLocks = Partial<Record<DamageSectionKey, DamageSectionLock>>;

export type DamageInsurerMailLogItem = {
  id: string;
  at: string;
  direction: 'outbound' | 'inbound_note';
  to: string;
  subject: string;
  status: 'sent' | 'stubbed' | 'failed';
  /** quote = deviz; avizare = pachet documente+poze; reinspection = solicitare reconstatare. */
  kind?: 'quote' | 'avizare' | 'reinspection';
  quoteId?: string;
  note?: string;
  pdfUrl?: string;
  attachmentUrls?: string[];
  error?: string;
};

export type ServiceCaseRecord = {
  id: string;
  clientId: string;
  vehicleId: string | null;
  workflowType: ServiceCaseWorkflowType;
  sourceType: ServiceCaseSourceType;
  sourceTicketId: string | null;
  currentStage: ServiceCaseStage;
  status: ServiceCaseStatus;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  notes: string | null;
  closedAt: string | null;
  awaitingPostApproval: boolean;
  postApprovalPath: PostApprovalPath | null;
  vehicleMovable: VehicleMovableState | null;
  /** YYYY-MM-DD — data evenimentului de daună. */
  damageEventOn: string | null;
  damageInsuranceType: DamageInsuranceType | null;
  damageClaimNumber: string | null;
  damageInsurerName: string | null;
  damageInsurerId: string | null;
  damageClaimStatus: DamageClaimStatus | null;
  damageInsurerAgreedAt: string | null;
  damageInsurerAgreedByUserId: string | null;
  damageInsurerAgreementNotes: string | null;
  damagePayerType: DamagePayerType | null;
  damageInsurerPipelineStatus: DamageInsurerPipelineStatus | null;
  damageDocuments: DamageDocumentItem[];
  damagePhotos: DamagePhotoItem[];
  damageSectionLocks: DamageSectionLocks;
  /** Franciză CASCO în cenți RON — plătită de client. */
  damageCascoFranchiseCents: number | null;
  damageInsurerEmail: string | null;
  damageQuoteOrigin: DamageQuoteOrigin | null;
  damageInsurerQuotePdfUrl: string | null;
  damageInsurerMailLog: DamageInsurerMailLogItem[];
  damageInspectionMode: DamageInspectionMode | null;
  damageInspectionNotePdfUrl: string | null;
  damageInspectionNoteFileName: string | null;
  damageInspectionNoteIssuedOn: string | null;
  damageInspectionNoteReceivedAt: string | null;
  damageInspectionNoteNotes: string | null;
  /** Istoric constatare: note PDF, solicitări reconstatare, PVS. */
  damageInspectionNotes: DamageConstatareHistoryItem[];
  damagePaymentAcceptancePdfUrl: string | null;
  damagePaymentAcceptanceFileName: string | null;
  damagePaymentAcceptanceReceivedAt: string | null;
  damagePaymentAcceptanceNotes: string | null;
  damagePaymentAcceptances: DamagePaymentAcceptanceItem[];
  createdAt: string;
  updatedAt: string;
  workOrders: WorkOrderRecord[];
  appointments: ServiceAppointmentRecord[];
};

export type PatchDamageClaimInput = {
  vehicleMovable?: VehicleMovableState | null;
  /** YYYY-MM-DD — data evenimentului de daună. */
  damageEventOn?: string | null;
  damageInsuranceType?: DamageInsuranceType | null;
  damageClaimNumber?: string | null;
  damageInsurerName?: string | null;
  damageInsurerId?: string | null;
  damageClaimStatus?: DamageClaimStatus | null;
  damagePayerType?: DamagePayerType | null;
  damageInsurerPipelineStatus?: DamageInsurerPipelineStatus | null;
  damageDocuments?: DamageDocumentItem[] | null;
  damagePhotos?: DamagePhotoItem[] | null;
  agreeInsurer?: boolean;
  clientPayerConfirmed?: boolean;
  damageInsurerAgreementNotes?: string | null;
  damageCascoFranchiseCents?: number | null;
  damageInsurerEmail?: string | null;
  damageQuoteOrigin?: DamageQuoteOrigin | null;
  damageInsurerQuotePdfUrl?: string | null;
  damageInspectionMode?: DamageInspectionMode | null;
  damageInspectionNotePdfUrl?: string | null;
  damageInspectionNoteFileName?: string | null;
  /** YYYY-MM-DD */
  damageInspectionNoteIssuedOn?: string | null;
  damageInspectionNoteNotes?: string | null;
  /** inspection_note (default) | pvs — la upload PDF pe constatare. */
  damageInspectionDocKind?: 'inspection_note' | 'pvs' | null;
  /** La upload PVS: id-ul cererii approved legate. */
  damagePvsLinkedRequestId?: string | null;
  damagePaymentAcceptancePdfUrl?: string | null;
  damagePaymentAcceptanceFileName?: string | null;
  damagePaymentAcceptanceNotes?: string | null;
  lockSection?: { section: string; lock: boolean };
};

export type SendDamageQuoteToInsurerInput = {
  quoteId?: string | null;
  note?: string | null;
  /** Absolute or app-relative URL to quote PDF (optional override). */
  pdfUrl?: string | null;
};

export type SendDamageAvizareToInsurerInput = {
  documentIds?: string[];
  photoIds?: string[];
  note?: string | null;
};

export type RequestDamageReinspectionInput = {
  /** Explicații / motiv — obligatoriu. */
  note?: string | null;
  photoIds?: string[];
};

export type DecideDamageReinspectionInput = {
  requestId: string;
  decision: 'approved' | 'rejected';
  rejectionReason?: string | null;
  /** Obligatoriu la approved — PDF/imagine document asigurător (aprobare / PVS). */
  approvalDocumentUrl?: string | null;
  approvalDocumentFileName?: string | null;
};

const PIPELINE_ORDER: DamageInsurerPipelineStatus[] = [
  DamageInsurerPipelineStatus.docs_pending,
  DamageInsurerPipelineStatus.ready_to_notify,
  DamageInsurerPipelineStatus.notified,
  DamageInsurerPipelineStatus.inspection_note,
  DamageInsurerPipelineStatus.reinspection_requested,
  DamageInsurerPipelineStatus.quote_ready,
  DamageInsurerPipelineStatus.payment_accepted,
];

const DAMAGE_SECTION_KEYS: DamageSectionKey[] = [
  'claim_info',
  'documents',
  'photos',
  'pipeline',
];

const PHOTO_KINDS = new Set(['exterior', 'damage_detail', 'odometer', 'repaired', 'other']);
const PIPELINE_STATUSES = new Set([
  'docs_pending',
  'ready_to_notify',
  'notified',
  'inspection_note',
  'reinspection_requested',
  'quote_ready',
  'payment_accepted',
]);
const PAYER_TYPES = new Set(['insurer', 'client']);
const MOVABLE_STATES = new Set(['movable', 'immovable']);
const INSPECTION_MODES = new Set(['photos', 'on_site']);

export type PostApprovalInput = {
  path: 'immediate' | 'reschedule';
};

export type AdvanceServiceCaseInput = {
  targetStage?: ServiceCaseStage;
  supplierId?: string | null;
  notes?: string | null;
};

function workflowTypeForTicket(ticketType: CrmTicketType): ServiceCaseWorkflowType {
  switch (ticketType) {
    case CrmTicketType.damage:
      return ServiceCaseWorkflowType.damage;
    case CrmTicketType.itp:
      return ServiceCaseWorkflowType.itp;
    case CrmTicketType.maintenance:
    case CrmTicketType.technical:
      return ServiceCaseWorkflowType.repair;
    case CrmTicketType.document:
      return ServiceCaseWorkflowType.insurance_rca;
    default:
      return ServiceCaseWorkflowType.repair;
  }
}

function stageLabel(stage: ServiceCaseStage): string {
  const labels: Record<ServiceCaseStage, string> = {
    intake: 'Intake',
    scheduled: 'Programare',
    work_order: 'Comandă service',
    in_service: 'In service',
    out_service: 'Out service',
    quote: 'Deviz',
    approval: 'Aprobare deviz',
    invoiced: 'Facturat',
    cost: 'Cost',
    closed: 'Închis',
  };
  return labels[stage];
}

@Injectable()
export class ServiceCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly partnerNotify: PartnerNotificationService,
    private readonly partnerMail: PartnerMailService,
  ) {}

  async getByTicketId(
    tenantSlug: string,
    ticketId: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return null;
    const row = await this.prisma.serviceCase.findFirst({
      where: { tenantId: tenant.id, sourceTicketId: ticketId },
      include: this.caseInclude(),
    });
    if (!row) return null;
    if (access && row.sourceTicketId) {
      const ticket = await this.prisma.crmTicket.findFirst({
        where: { id: row.sourceTicketId, tenantId: tenant.id },
      });
      if (ticket && !canReadTicket(access, ticket)) {
        throw new ForbiddenException('Service case not accessible');
      }
    } else if (access && !isTenantWideAccess(access)) {
      assertClientAccess(access, row.clientId);
    }
    return this.toRecord(row);
  }

  async startFromTicket(
    tenantSlug: string,
    ticketId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const ticket = await this.prisma.crmTicket.findFirst({
      where: { id: ticketId, tenantId: tenant.id },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (access) assertServiceCaseWrite(access, ticket.clientId);

    const existing = await this.prisma.serviceCase.findFirst({
      where: { sourceTicketId: ticketId },
      include: this.caseInclude(),
    });
    if (existing) return this.toRecord(existing);

    const workflowType = workflowTypeForTicket(ticket.ticketType);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceCase.create({
        data: {
          tenantId: tenant.id,
          clientId: ticket.clientId,
          vehicleId: ticket.vehicleId,
          workflowType,
          sourceType: ServiceCaseSourceType.ticket,
          sourceTicketId: ticket.id,
          sourceReminderActionId: ticket.reminderActionId,
          serviceTypeId: ticket.serviceTypeId,
          currentStage: ServiceCaseStage.intake,
          status: ServiceCaseStatus.active,
          title: ticket.subject,
          notes: ticket.description,
          vehicleMovable: ticket.vehicleMovable ?? null,
        },
        include: this.caseInclude(),
      });

      if (ticket.vehicleMovable === VehicleMovableState.immovable) {
        await this.ensureDraftRoadsideForImmovable(tx, tenant.id, created);
      }

      await tx.crmTicketLink.create({
        data: {
          tenantId: tenant.id,
          ticketId: ticket.id,
          entityType: CrmTicketLinkEntityType.service_case,
          entityId: created.id,
        },
      });

      await tx.crmTicketEvent.create({
        data: {
          tenantId: tenant.id,
          ticketId: ticket.id,
          kind: CrmTicketEventKind.workflow_advance,
          body: `Dosar lucrare creat (${workflowType}).`,
          payload: { stage: ServiceCaseStage.intake, serviceCaseId: created.id },
          actorUserId: actorUserId ?? null,
        },
      });

      if (ticket.status === CrmTicketStatus.open) {
        await tx.crmTicket.update({
          where: { id: ticket.id },
          data: { status: CrmTicketStatus.in_progress },
        });
      }

      return created;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.start_from_ticket',
      entityType: 'service_case',
      entityId: row.id,
      meta: { ticketId },
    });

    return this.toRecord(row);
  }

  async advance(
    tenantSlug: string,
    caseId: string,
    dto: AdvanceServiceCaseInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: { sourceTicket: true },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (row.status === ServiceCaseStatus.completed || row.status === ServiceCaseStatus.cancelled) {
      throw new BadRequestException('Service case is already closed');
    }

    if (access) assertServiceCaseWrite(access, row.clientId);

    const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(row.currentStage);
    const nextStage =
      dto.targetStage ??
      (currentIdx < SERVICE_CASE_STAGE_ORDER.length - 1
        ? SERVICE_CASE_STAGE_ORDER[currentIdx + 1]
        : row.currentStage);

    if (SERVICE_CASE_STAGE_ORDER.indexOf(nextStage) <= currentIdx && nextStage !== row.currentStage) {
      throw new BadRequestException('Cannot move to an earlier stage');
    }

    let supplierId = row.supplierId;
    if (dto.supplierId !== undefined) {
      if (dto.supplierId) {
        await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
        supplierId = dto.supplierId;
      } else {
        supplierId = null;
      }
    }

    const data: {
      currentStage: ServiceCaseStage;
      supplierId?: string | null;
      notes?: string | null;
      status?: ServiceCaseStatus;
      closedAt?: Date | null;
    } = {
      currentStage: nextStage,
      supplierId,
    };
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (nextStage === ServiceCaseStage.closed) {
      data.status = ServiceCaseStatus.completed;
      data.closedAt = new Date();
    }

    const updated = await this.prisma.serviceCase.update({
      where: { id: caseId },
      data,
      include: this.caseInclude(),
    });

    if (row.sourceTicketId) {
      await this.prisma.crmTicketEvent.create({
        data: {
          tenantId: tenant.id,
          ticketId: row.sourceTicketId,
          kind: CrmTicketEventKind.workflow_advance,
          body: `Dosar avansat: ${stageLabel(row.currentStage)} → ${stageLabel(nextStage)}.`,
          payload: {
            fromStage: row.currentStage,
            toStage: nextStage,
            serviceCaseId: caseId,
          },
          actorUserId: actorUserId ?? null,
        },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.advance',
      entityType: 'service_case',
      entityId: caseId,
      meta: { from: row.currentStage, to: nextStage },
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: caseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async patchDamageClaim(
    tenantSlug: string,
    caseId: string,
    dto: PatchDamageClaimInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: {
        workOrders: {
          select: { id: true, supplierId: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerWrite(access);
        const partnerWo = row.workOrders.find((w) =>
          allowedSupplierIds(access).includes(w.supplierId ?? ''),
        );
        if (!partnerWo) {
          throw new ForbiddenException('No partner work order on this damage case');
        }
        assertPartnerSupplierId(access, partnerWo.supplierId);
      } else {
        assertServiceCaseWrite(access, row.clientId);
      }
    }

    const vehicleMovableOnly =
      dto.vehicleMovable !== undefined &&
      dto.damageEventOn === undefined &&
      dto.damageInsuranceType === undefined &&
      dto.damageClaimNumber === undefined &&
      dto.damageInsurerName === undefined &&
      dto.damageInsurerId === undefined &&
      dto.damageClaimStatus === undefined &&
      dto.damagePayerType === undefined &&
      dto.damageInsurerPipelineStatus === undefined &&
      dto.damageDocuments === undefined &&
      dto.damagePhotos === undefined &&
      dto.agreeInsurer === undefined &&
      dto.clientPayerConfirmed === undefined &&
      dto.damageInsurerAgreementNotes === undefined &&
      dto.damageCascoFranchiseCents === undefined &&
      dto.damageInsurerEmail === undefined &&
      dto.damageQuoteOrigin === undefined &&
      dto.damageInsurerQuotePdfUrl === undefined &&
      dto.damageInspectionMode === undefined &&
      dto.damageInspectionNotePdfUrl === undefined &&
      dto.damageInspectionNoteFileName === undefined &&
      dto.damageInspectionNoteIssuedOn === undefined &&
      dto.damageInspectionNoteNotes === undefined &&
      dto.damagePaymentAcceptancePdfUrl === undefined &&
      dto.damagePaymentAcceptanceFileName === undefined &&
      dto.damagePaymentAcceptanceNotes === undefined &&
      dto.lockSection === undefined;

    if (row.workflowType !== ServiceCaseWorkflowType.damage && !vehicleMovableOnly) {
      throw new BadRequestException('Damage claim fields apply only to damage workflow');
    }

    const locks = this.parseDamageSectionLocks(row.damageSectionLocksJson);
    const actorLabel = access?.displayName;

    if (dto.lockSection?.lock === false) {
      const section = this.assertDamageSectionKey(dto.lockSection.section);
      const existingLock = locks[section];
      if (existingLock) {
        const isOwner = actorUserId && existingLock.lockedByUserId === actorUserId;
        const isAdmin = access?.membershipRole === MembershipRole.tenant_admin;
        if (!isOwner && !isAdmin) {
          throw new ForbiddenException('Only the locker or tenant_admin can unlock this section');
        }
        delete locks[section];
      }
    }

    this.assertUnlockedForPatch(locks, dto);

    const data: Prisma.ServiceCaseUncheckedUpdateInput = {};

    if (dto.vehicleMovable !== undefined) {
      if (dto.vehicleMovable !== null && !MOVABLE_STATES.has(dto.vehicleMovable)) {
        throw new BadRequestException('vehicleMovable must be movable or immovable');
      }
      data.vehicleMovable = dto.vehicleMovable;
    }
    if (dto.damageEventOn !== undefined) {
      if (dto.damageEventOn === null || dto.damageEventOn === '') {
        data.damageEventOn = null;
      } else {
        const d = new Date(`${dto.damageEventOn.trim()}T12:00:00.000Z`);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('damageEventOn must be YYYY-MM-DD');
        }
        data.damageEventOn = d;
      }
    }
    if (dto.damageInsuranceType !== undefined) data.damageInsuranceType = dto.damageInsuranceType;
    if (dto.damageClaimNumber !== undefined) {
      data.damageClaimNumber = dto.damageClaimNumber?.trim() || null;
    }
    if (dto.damageInsurerName !== undefined) {
      data.damageInsurerName = dto.damageInsurerName?.trim() || null;
    }
    if (dto.damageInsurerId !== undefined) {
      const insurerId = dto.damageInsurerId?.trim() || null;
      if (!insurerId) {
        data.damageInsurerId = null;
      } else {
        const insurer = await this.prisma.insurer.findFirst({
          where: { id: insurerId, tenantId: tenant.id, active: true },
          select: { id: true, name: true, email: true },
        });
        if (!insurer) {
          throw new BadRequestException('damageInsurerId not found in catalog (or inactive)');
        }
        data.damageInsurerId = insurer.id;
        if (dto.damageInsurerName === undefined) {
          data.damageInsurerName = insurer.name;
        }
        if (dto.damageInsurerEmail === undefined && insurer.email) {
          data.damageInsurerEmail = insurer.email;
        }
      }
    }
    if (dto.damageClaimStatus !== undefined) data.damageClaimStatus = dto.damageClaimStatus;
    if (dto.damagePayerType !== undefined) {
      if (dto.damagePayerType !== null && !PAYER_TYPES.has(dto.damagePayerType)) {
        throw new BadRequestException('damagePayerType must be insurer or client');
      }
      data.damagePayerType = dto.damagePayerType;
      if (dto.damagePayerType === DamagePayerType.client) {
        // Client pays — insurer pipeline gate is ignored (status may remain for audit).
      }
    }
    if (dto.damageInsurerPipelineStatus !== undefined) {
      if (
        dto.damageInsurerPipelineStatus !== null &&
        !PIPELINE_STATUSES.has(dto.damageInsurerPipelineStatus)
      ) {
        throw new BadRequestException('Invalid damageInsurerPipelineStatus');
      }
      data.damageInsurerPipelineStatus = dto.damageInsurerPipelineStatus;
      if (
        dto.damageInsurerPipelineStatus === DamageInsurerPipelineStatus.payment_accepted &&
        (dto.damagePayerType === DamagePayerType.insurer ||
          (dto.damagePayerType === undefined &&
            (row.damagePayerType === DamagePayerType.insurer || row.damagePayerType == null)))
      ) {
        if (!row.damageInsurerAgreedAt) {
          data.damageInsurerAgreedAt = new Date();
          data.damageInsurerAgreedByUserId = actorUserId ?? null;
        }
      }
    }
    if (dto.damageDocuments !== undefined) {
      data.damageDocumentsJson = dto.damageDocuments ?? Prisma.JsonNull;
    }
    if (dto.damagePhotos !== undefined) {
      data.damagePhotosJson =
        dto.damagePhotos == null
          ? Prisma.JsonNull
          : this.normalizeDamagePhotos(dto.damagePhotos);
    }
    if (dto.damageInsurerAgreementNotes !== undefined) {
      data.damageInsurerAgreementNotes = dto.damageInsurerAgreementNotes?.trim() || null;
    }
    if (dto.damageCascoFranchiseCents !== undefined) {
      if (dto.damageCascoFranchiseCents !== null) {
        if (
          !Number.isInteger(dto.damageCascoFranchiseCents) ||
          dto.damageCascoFranchiseCents < 0
        ) {
          throw new BadRequestException(
            'damageCascoFranchiseCents must be a non-negative integer (cents)',
          );
        }
      }
      data.damageCascoFranchiseCents = dto.damageCascoFranchiseCents;
    }
    if (dto.damageInsurerEmail !== undefined) {
      const email = dto.damageInsurerEmail?.trim() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('damageInsurerEmail is invalid');
      }
      data.damageInsurerEmail = email;
    }
    if (dto.damageQuoteOrigin !== undefined) {
      if (
        dto.damageQuoteOrigin !== null &&
        dto.damageQuoteOrigin !== DamageQuoteOrigin.prepared_by_us &&
        dto.damageQuoteOrigin !== DamageQuoteOrigin.received_from_insurer
      ) {
        throw new BadRequestException(
          'damageQuoteOrigin must be prepared_by_us or received_from_insurer',
        );
      }
      data.damageQuoteOrigin = dto.damageQuoteOrigin;
    }
    if (dto.damageInsurerQuotePdfUrl !== undefined) {
      data.damageInsurerQuotePdfUrl = dto.damageInsurerQuotePdfUrl?.trim() || null;
      if (data.damageInsurerQuotePdfUrl && !data.damageQuoteOrigin && !row.damageQuoteOrigin) {
        data.damageQuoteOrigin = DamageQuoteOrigin.received_from_insurer;
      }
      if (
        data.damageInsurerQuotePdfUrl &&
        !dto.damageInsurerPipelineStatus &&
        row.damageInsurerPipelineStatus !== DamageInsurerPipelineStatus.payment_accepted
      ) {
        data.damageInsurerPipelineStatus = DamageInsurerPipelineStatus.quote_ready;
      }
    }
    if (dto.damageInspectionMode !== undefined) {
      if (dto.damageInspectionMode !== null && !INSPECTION_MODES.has(dto.damageInspectionMode)) {
        throw new BadRequestException('damageInspectionMode must be photos or on_site');
      }
      data.damageInspectionMode = dto.damageInspectionMode;
    }
    if (dto.damageInspectionNotePdfUrl !== undefined) {
      const url = dto.damageInspectionNotePdfUrl?.trim() || null;
      data.damageInspectionNotePdfUrl = url;
      if (url) {
        const receivedAt = new Date();
        data.damageInspectionNoteReceivedAt = receivedAt;
        const fileName =
          dto.damageInspectionNoteFileName?.trim() ||
          row.damageInspectionNoteFileName ||
          null;
        if (dto.damageInspectionNoteFileName !== undefined) {
          data.damageInspectionNoteFileName = fileName;
        }
        const mode =
          dto.damageInspectionMode !== undefined
            ? dto.damageInspectionMode
            : row.damageInspectionMode;
        const issuedOn =
          dto.damageInspectionNoteIssuedOn !== undefined
            ? dto.damageInspectionNoteIssuedOn?.trim() || null
            : row.damageInspectionNoteIssuedOn
              ? row.damageInspectionNoteIssuedOn.toISOString().slice(0, 10)
              : null;
        const notes =
          dto.damageInspectionNoteNotes !== undefined
            ? dto.damageInspectionNoteNotes?.trim() || null
            : row.damageInspectionNoteNotes;
        const docKind =
          dto.damageInspectionDocKind === 'pvs' ? 'pvs' : 'inspection_note';
        const prevNotes = this.parseDamageConstatareHistory(row.damageInspectionNotesJson);

        if (docKind === 'pvs') {
          const requestId = dto.damagePvsLinkedRequestId?.trim() || null;
          if (!requestId) {
            throw new BadRequestException(
              'damagePvsLinkedRequestId is required when uploading PVS',
            );
          }
          const reqIdx = prevNotes.findIndex(
            (h) => h.kind === 'reinspection_request' && h.id === requestId,
          );
          if (reqIdx < 0) {
            throw new BadRequestException('Cererea de reconstatare nu a fost găsită');
          }
          const req = prevNotes[reqIdx] as DamageReinspectionRequestItem;
          if (req.status !== 'approved') {
            throw new BadRequestException(
              'PVS se încarcă doar pe o solicitare aprobată de asigurător',
            );
          }
          if (req.linkedPvsId) {
            throw new BadRequestException('Această solicitare are deja un PVS legat');
          }
          const pvsSequence =
            prevNotes.filter((h): h is DamageInspectionNoteItem => h.kind === 'pvs')
              .length + 1;
          const pvsId = `pvs_${Date.now()}`;
          const pvsEntry: DamageInspectionNoteItem = {
            id: pvsId,
            kind: 'pvs',
            sequence: pvsSequence,
            requestId,
            pdfUrl: url,
            fileName: fileName ?? undefined,
            mode: mode ?? null,
            issuedOn,
            receivedAt: receivedAt.toISOString(),
            notes,
          };
          const nextHistory = [...prevNotes];
          nextHistory[reqIdx] = { ...req, linkedPvsId: pvsId };
          data.damageInspectionNotesJson = [pvsEntry, ...nextHistory].slice(
            0,
            50,
          ) as unknown as Prisma.InputJsonValue;
        } else {
          const entry: DamageInspectionNoteItem = {
            id: `insp_${Date.now()}`,
            kind: 'inspection_note',
            pdfUrl: url,
            fileName: fileName ?? undefined,
            mode: mode ?? null,
            issuedOn,
            receivedAt: receivedAt.toISOString(),
            notes,
          };
          data.damageInspectionNotesJson = [entry, ...prevNotes].slice(
            0,
            50,
          ) as unknown as Prisma.InputJsonValue;
        }

        const current =
          (data.damageInsurerPipelineStatus as DamageInsurerPipelineStatus | undefined) ??
          row.damageInsurerPipelineStatus;
        const currentIdx = current ? PIPELINE_ORDER.indexOf(current) : -1;
        const noteIdx = PIPELINE_ORDER.indexOf(DamageInsurerPipelineStatus.inspection_note);
        const quoteIdx = PIPELINE_ORDER.indexOf(DamageInsurerPipelineStatus.quote_ready);
        if (currentIdx < 0 || currentIdx < noteIdx) {
          data.damageInsurerPipelineStatus = DamageInsurerPipelineStatus.inspection_note;
        } else if (current === DamageInsurerPipelineStatus.reinspection_requested) {
          data.damageInsurerPipelineStatus = DamageInsurerPipelineStatus.inspection_note;
        } else if (currentIdx >= quoteIdx) {
          // keep quote_ready / payment_accepted
        }
      } else {
        data.damageInspectionNoteReceivedAt = null;
        if (dto.damageInspectionNoteFileName === undefined) {
          data.damageInspectionNoteFileName = null;
        }
      }
    }
    if (dto.damageInspectionNoteFileName !== undefined && dto.damageInspectionNotePdfUrl === undefined) {
      data.damageInspectionNoteFileName = dto.damageInspectionNoteFileName?.trim() || null;
    }
    if (dto.damageInspectionNoteIssuedOn !== undefined) {
      if (dto.damageInspectionNoteIssuedOn === null || dto.damageInspectionNoteIssuedOn === '') {
        data.damageInspectionNoteIssuedOn = null;
      } else {
        const d = new Date(`${dto.damageInspectionNoteIssuedOn.trim()}T12:00:00.000Z`);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('damageInspectionNoteIssuedOn must be YYYY-MM-DD');
        }
        data.damageInspectionNoteIssuedOn = d;
      }
    }
    if (dto.damageInspectionNoteNotes !== undefined) {
      data.damageInspectionNoteNotes = dto.damageInspectionNoteNotes?.trim() || null;
    }
    if (dto.damagePaymentAcceptancePdfUrl !== undefined) {
      const url = dto.damagePaymentAcceptancePdfUrl?.trim() || null;
      data.damagePaymentAcceptancePdfUrl = url;
      if (url) {
        const receivedAt = new Date();
        data.damagePaymentAcceptanceReceivedAt = receivedAt;
        if (
          !dto.damageInsurerPipelineStatus &&
          row.damageInsurerPipelineStatus !== DamageInsurerPipelineStatus.payment_accepted
        ) {
          data.damageInsurerPipelineStatus = DamageInsurerPipelineStatus.payment_accepted;
        }
        const notes =
          dto.damagePaymentAcceptanceNotes !== undefined
            ? dto.damagePaymentAcceptanceNotes?.trim() || null
            : row.damagePaymentAcceptanceNotes;
        const fileName =
          dto.damagePaymentAcceptanceFileName !== undefined
            ? dto.damagePaymentAcceptanceFileName?.trim() || undefined
            : row.damagePaymentAcceptanceFileName ?? undefined;
        const prev = this.parsePaymentAcceptances(row.damagePaymentAcceptancesJson);
        const legacySeed =
          prev.length === 0 && row.damagePaymentAcceptancePdfUrl?.trim()
            ? [
                {
                  id: `accept_legacy_${row.id.slice(-8)}`,
                  sequence: 1,
                  pdfUrl: row.damagePaymentAcceptancePdfUrl.trim(),
                  fileName: row.damagePaymentAcceptanceFileName ?? undefined,
                  receivedAt:
                    row.damagePaymentAcceptanceReceivedAt?.toISOString() ??
                    row.createdAt.toISOString(),
                  notes: row.damagePaymentAcceptanceNotes ?? null,
                } satisfies DamagePaymentAcceptanceItem,
              ]
            : [];
        const base = prev.length ? prev : legacySeed;
        // Înlocuiește ultima înregistrare dacă e același sequence „curent”, altfel adaugă.
        const nextItem: DamagePaymentAcceptanceItem = {
          id: `accept_${Date.now()}`,
          sequence: base.length ? Math.max(...base.map((a) => a.sequence)) + 1 : 1,
          pdfUrl: url,
          fileName,
          receivedAt: receivedAt.toISOString(),
          notes,
        };
        // Fiecare upload PDF = accept nou în istoric (Accept 1, 2, …).
        const nextAcceptances: DamagePaymentAcceptanceItem[] = [nextItem, ...base].slice(0, 30);
        data.damagePaymentAcceptancesJson = nextAcceptances as unknown as Prisma.InputJsonValue;
      } else {
        data.damagePaymentAcceptanceReceivedAt = null;
        if (dto.damagePaymentAcceptanceFileName === undefined) {
          data.damagePaymentAcceptanceFileName = null;
        }
      }
    }
    if (dto.damagePaymentAcceptanceFileName !== undefined) {
      data.damagePaymentAcceptanceFileName = dto.damagePaymentAcceptanceFileName?.trim() || null;
    }
    if (dto.damagePaymentAcceptanceNotes !== undefined) {
      data.damagePaymentAcceptanceNotes = dto.damagePaymentAcceptanceNotes?.trim() || null;
    }

    if (dto.agreeInsurer === true) {
      data.damageInsurerAgreedAt = new Date();
      data.damageInsurerAgreedByUserId = actorUserId ?? null;
      if (dto.damageClaimStatus === undefined) {
        data.damageClaimStatus = DamageClaimStatus.agreed;
      }
    }
    if (dto.clientPayerConfirmed === true) {
      const payer =
        dto.damagePayerType !== undefined ? dto.damagePayerType : row.damagePayerType;
      if (payer !== DamagePayerType.client) {
        throw new BadRequestException(
          'clientPayerConfirmed requires damagePayerType=client',
        );
      }
      data.damageInsurerAgreedAt = new Date();
      data.damageInsurerAgreedByUserId = actorUserId ?? null;
    }

    if (dto.lockSection?.lock === true) {
      const section = this.assertDamageSectionKey(dto.lockSection.section);
      if (!actorUserId) {
        throw new BadRequestException('Actor required to lock section');
      }
      locks[section] = {
        lockedByUserId: actorUserId,
        lockedByLabel: actorLabel,
        lockedAt: new Date().toISOString(),
      };
    }

    if (dto.lockSection !== undefined) {
      data.damageSectionLocksJson =
        Object.keys(locks).length === 0 ? Prisma.JsonNull : (locks as Prisma.InputJsonValue);
    }

    const nextMovable =
      dto.vehicleMovable !== undefined ? dto.vehicleMovable : row.vehicleMovable;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No damage claim fields to update');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.serviceCase.update({
        where: { id: caseId },
        data,
        include: this.caseInclude(),
      });

      if (nextMovable === VehicleMovableState.immovable) {
        await this.ensureDraftRoadsideForImmovable(tx, tenant.id, next);
      }

      if (row.sourceTicketId && row.workflowType === ServiceCaseWorkflowType.damage) {
        const parts: string[] = [];
        if (dto.agreeInsurer) parts.push('acord asigurător înregistrat');
        if (dto.clientPayerConfirmed) parts.push('plătitor client confirmat');
        if (dto.damageClaimStatus) parts.push(`status: ${dto.damageClaimStatus}`);
        if (dto.damageClaimNumber?.trim()) parts.push(`nr. dosar: ${dto.damageClaimNumber.trim()}`);
        if (dto.damageEventOn !== undefined) {
          parts.push(
            dto.damageEventOn?.trim()
              ? `data eveniment: ${dto.damageEventOn.trim()}`
              : 'data eveniment ștearsă',
          );
        }
        if (dto.damageInsurerPipelineStatus) {
          parts.push(`pipeline: ${dto.damageInsurerPipelineStatus}`);
        }
        if (dto.damagePayerType) parts.push(`plătitor: ${dto.damagePayerType}`);
        if (dto.lockSection) {
          parts.push(
            dto.lockSection.lock
              ? `secțiune blocată: ${dto.lockSection.section}`
              : `secțiune deblocată: ${dto.lockSection.section}`,
          );
        }
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: row.sourceTicketId,
            kind: CrmTicketEventKind.damage_claim_update,
            body:
              parts.length > 0
                ? `Actualizare daună — ${parts.join(', ')}.`
                : 'Actualizare dosar daună / asigurare.',
            payload: {
              serviceCaseId: caseId,
              damageInsuranceType: next.damageInsuranceType,
              damageClaimNumber: next.damageClaimNumber,
              damageInsurerName: next.damageInsurerName,
              damageClaimStatus: next.damageClaimStatus,
              damageInsurerAgreedAt: next.damageInsurerAgreedAt?.toISOString() ?? null,
              damagePayerType: next.damagePayerType,
              damageInsurerPipelineStatus: next.damageInsurerPipelineStatus,
              vehicleMovable: next.vehicleMovable,
              agreeInsurer: dto.agreeInsurer === true,
              clientPayerConfirmed: dto.clientPayerConfirmed === true,
            },
            actorUserId: actorUserId ?? null,
          },
        });
      }

      return next;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.damage_claim_patch',
      entityType: 'service_case',
      entityId: caseId,
      meta: dto,
    });

    await this.syncWorkOrdersFromDamageClaim(tenant.id, caseId, updated, actorUserId);
    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded ?? updated);
  }

  async sendDamageQuoteToInsurer(
    tenantSlug: string,
    caseId: string,
    dto: SendDamageQuoteToInsurerInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: {
        workOrders: {
          select: { id: true, supplierId: true, displayNumber: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerWrite(access);
        const partnerWo = row.workOrders.find((w) =>
          allowedSupplierIds(access).includes(w.supplierId ?? ''),
        );
        if (!partnerWo) {
          throw new ForbiddenException('No partner work order on this damage case');
        }
        assertPartnerSupplierId(access, partnerWo.supplierId);
      } else {
        assertServiceCaseWrite(access, row.clientId);
      }
    }
    if (row.workflowType !== ServiceCaseWorkflowType.damage) {
      throw new BadRequestException('Send to insurer applies only to damage workflow');
    }
    if (row.damagePayerType === DamagePayerType.client) {
      throw new BadRequestException('Plătitor client — nu se trimite către asigurător');
    }

    const to = row.damageInsurerEmail?.trim();
    if (!to) {
      throw new BadRequestException('Completează emailul asigurătorului pe dosar');
    }

    const origin = row.damageQuoteOrigin ?? DamageQuoteOrigin.prepared_by_us;
    const wo = row.workOrders[0];
    let quoteId = dto.quoteId?.trim() || null;
    if (!quoteId && wo) {
      const q = await this.prisma.workOrderQuote.findFirst({
        where: { workOrderId: wo.id },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      quoteId = q?.id ?? null;
    }

    const webOrigin = (process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
    const pdfFromDossier = row.damageInsurerQuotePdfUrl?.trim() || null;
    const pdfUrl =
      dto.pdfUrl?.trim() ||
      pdfFromDossier ||
      (quoteId && wo && webOrigin
        ? `${webOrigin}/api/work-orders/${wo.id}/quotes/${quoteId}/pdf`
        : null);

    const insurerLabel = row.damageInsurerName?.trim() || 'asigurător';
    const claim = row.damageClaimNumber?.trim() || caseId.slice(-6).toUpperCase();
    const subject = `Deviz daună ${claim} — ${row.title}`;
    const mailOpts = await this.resolveDamageMailOptions(
      tenant.id,
      tenant.mailSettings,
      actorUserId,
      row.clientId,
    );
    const bodyLines = [
      `Bună ziua,`,
      ``,
      `Vă transmitem devizul pentru dosarul de daună ${claim} (${insurerLabel}).`,
      row.damageCascoFranchiseCents != null
        ? `Franciză CASCO menționată: ${(row.damageCascoFranchiseCents / 100).toFixed(2)} RON (plătită de client).`
        : null,
      wo?.displayNumber ? `Comandă service: ${wo.displayNumber}.` : null,
      pdfUrl ? `PDF deviz: ${pdfUrl}` : 'PDF: atașați / descărcați din platformă (link indisponibil).',
      dto.note?.trim() ? `Notă: ${dto.note.trim()}` : null,
      ``,
      `Origine: ${origin === DamageQuoteOrigin.received_from_insurer ? 'deviz primit/încărcat de la asigurător' : 'deviz întocmit de service / flotă'}.`,
      ``,
      `Cu stimă,`,
      mailOpts.signature,
    ].filter((l) => l != null) as string[];
    const body = bodyLines.join('\n');

    let status: DamageInsurerMailLogItem['status'] = 'stubbed';
    let error: string | undefined;
    if (this.partnerMail.isConfigured()) {
      try {
        const attachments = pdfUrl
          ? await this.partnerMail.fetchAttachmentsFromUrls([pdfUrl], { maxFiles: 1 })
          : [];
        const bodyWithAttachNote =
          attachments.length > 0
            ? `${body}\n\n(Fișierul PDF este atașat acestui email.)`
            : body;
        await this.partnerMail.send({
          to,
          subject,
          body: bodyWithAttachNote,
          attachments,
          fromName: mailOpts.fromName,
          replyTo: mailOpts.replyTo,
          cc: mailOpts.cc,
        });
        status = 'sent';
      } catch (e) {
        status = 'failed';
        error = e instanceof Error ? e.message : 'SMTP send failed';
      }
    }

    const logItem: DamageInsurerMailLogItem = {
      id: `mail_${Date.now()}`,
      at: new Date().toISOString(),
      direction: 'outbound',
      to,
      subject,
      status,
      kind: 'quote',
      quoteId: quoteId ?? undefined,
      note: dto.note?.trim() || undefined,
      pdfUrl: pdfUrl ?? undefined,
      error,
    };
    const prevLog = this.parseDamageInsurerMailLog(row.damageInsurerMailLogJson);
    const nextLog = [logItem, ...prevLog].slice(0, 50);

    const updated = await this.prisma.serviceCase.update({
      where: { id: caseId },
      data: {
        damageQuoteOrigin: origin,
        damageInsurerMailLogJson: nextLog as unknown as Prisma.InputJsonValue,
        damageInsurerPipelineStatus:
          row.damageInsurerPipelineStatus === DamageInsurerPipelineStatus.payment_accepted
            ? row.damageInsurerPipelineStatus
            : DamageInsurerPipelineStatus.quote_ready,
      },
      include: this.caseInclude(),
    });

    if (row.sourceTicketId) {
      await this.prisma.crmTicketEvent.create({
        data: {
          tenantId: tenant.id,
          ticketId: row.sourceTicketId,
          kind: CrmTicketEventKind.damage_claim_update,
          body:
            status === 'sent'
              ? `Deviz trimis către asigurător (${to}).`
              : status === 'stubbed'
                ? `Deviz către asigurător înregistrat (SMTP neconfigurat) — ${to}.`
                : `Trimitere către asigurător eșuată — ${error ?? 'eroare'}.`,
          payload: { serviceCaseId: caseId, mail: logItem },
          actorUserId: actorUserId ?? null,
        },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.damage_quote_send_insurer',
      entityType: 'service_case',
      entityId: caseId,
      meta: { to, status, quoteId },
    });

    if (status === 'failed') {
      throw new BadRequestException(error || 'Trimiterea către asigurător a eșuat');
    }

    await this.syncWorkOrdersFromDamageClaim(tenant.id, caseId, updated, actorUserId);
    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded ?? updated);
  }

  async sendDamageAvizareToInsurer(
    tenantSlug: string,
    caseId: string,
    dto: SendDamageAvizareToInsurerInput,
    actorUserId?: string | null,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: {
        workOrders: {
          select: { id: true, supplierId: true, displayNumber: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerWrite(access);
        const partnerWo = row.workOrders.find((w) =>
          allowedSupplierIds(access).includes(w.supplierId ?? ''),
        );
        if (!partnerWo) {
          throw new ForbiddenException('No partner work order on this damage case');
        }
        assertPartnerSupplierId(access, partnerWo.supplierId);
      } else {
        assertServiceCaseWrite(access, row.clientId);
      }
    }
    if (row.workflowType !== ServiceCaseWorkflowType.damage) {
      throw new BadRequestException('Avizarea se aplică doar pe workflow daună');
    }
    if (row.damagePayerType === DamagePayerType.client) {
      throw new BadRequestException('Plătitor client — nu se trimite avizare către asigurător');
    }

    const to = row.damageInsurerEmail?.trim();
    if (!to) {
      throw new BadRequestException('Completează emailul asigurătorului pe dosar');
    }

    const docs = this.parseDamageDocuments(row.damageDocumentsJson);
    const photos = this.parseDamagePhotos(row.damagePhotosJson);
    const docIdSet = new Set((dto.documentIds ?? []).map((id) => id.trim()).filter(Boolean));
    const photoIdSet = new Set((dto.photoIds ?? []).map((id) => id.trim()).filter(Boolean));
    if (docIdSet.size === 0 && photoIdSet.size === 0) {
      throw new BadRequestException('Selectează cel puțin un document sau o poză pentru avizare');
    }

    const selectedDocs = docs.filter((d) => docIdSet.has(d.id));
    const selectedPhotos = photos.filter((p) => photoIdSet.has(p.id));
    if (selectedDocs.length !== docIdSet.size || selectedPhotos.length !== photoIdSet.size) {
      throw new BadRequestException('Unele documente/poze selectate nu mai există pe dosar');
    }

    const webOrigin = (process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
    const absolutize = (url: string) => {
      const u = url.trim();
      if (!u) return u;
      if (/^https?:\/\//i.test(u)) return u;
      if (!webOrigin) return u;
      return `${webOrigin}${u.startsWith('/') ? '' : '/'}${u}`;
    };

    const attachmentLines: string[] = [];
    const attachmentUrls: string[] = [];
    for (const d of selectedDocs) {
      const label = d.label ?? d.kind;
      if (d.url) {
        const abs = absolutize(d.url);
        attachmentUrls.push(abs);
        attachmentLines.push(`- Document: ${label}${d.fileName ? ` (${d.fileName})` : ''} — ${abs}`);
      } else {
        attachmentLines.push(`- Document: ${label} — fără fișier pe dosar (bifat ca primit)`);
      }
    }
    for (const p of selectedPhotos) {
      const abs = absolutize(p.url);
      attachmentUrls.push(abs);
      const kindLabel =
        p.kind === 'exterior'
          ? 'Exterior'
          : p.kind === 'damage_detail'
            ? 'Detaliu avarie'
            : p.kind === 'odometer'
              ? 'Odometru'
              : 'Poză';
      attachmentLines.push(
        `- Poză: ${kindLabel}${p.caption ? ` · ${p.caption}` : ''} — ${abs}`,
      );
    }

    const wo = row.workOrders[0];
    const insurerLabel = row.damageInsurerName?.trim() || 'asigurător';
    const claim = row.damageClaimNumber?.trim() || caseId.slice(-6).toUpperCase();
    const subject = `Avizare daună ${claim} — ${row.title}`;
    const mailOpts = await this.resolveDamageMailOptions(
      tenant.id,
      tenant.mailSettings,
      actorUserId,
      row.clientId,
    );
    const bodyLines = [
      `Bună ziua,`,
      ``,
      `Vă transmitem pachetul de avizare pentru dosarul de daună ${claim} (${insurerLabel}).`,
      wo?.displayNumber ? `Comandă service: ${wo.displayNumber}.` : null,
      ``,
      `Atașamente / linkuri:`,
      ...attachmentLines,
      dto.note?.trim() ? `` : null,
      dto.note?.trim() ? `Notă: ${dto.note.trim()}` : null,
      ``,
      `Cu stimă,`,
      mailOpts.signature,
    ].filter((l) => l != null) as string[];
    let body = bodyLines.join('\n');

    let status: DamageInsurerMailLogItem['status'] = 'stubbed';
    let error: string | undefined;
    if (this.partnerMail.isConfigured()) {
      try {
        const attachments = await this.partnerMail.fetchAttachmentsFromUrls(attachmentUrls);
        if (attachments.length > 0) {
          body += `\n\n(${attachments.length} fișier(e) atașate acestui email; linkurile de mai sus rămân ca rezervă.)`;
        }
        await this.partnerMail.send({
          to,
          subject,
          body,
          attachments,
          fromName: mailOpts.fromName,
          replyTo: mailOpts.replyTo,
          cc: mailOpts.cc,
        });
        status = 'sent';
      } catch (e) {
        status = 'failed';
        error = e instanceof Error ? e.message : 'SMTP send failed';
      }
    }

    const logItem: DamageInsurerMailLogItem = {
      id: `mail_${Date.now()}`,
      at: new Date().toISOString(),
      direction: 'outbound',
      to,
      subject,
      status,
      kind: 'avizare',
      note: dto.note?.trim() || undefined,
      attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
      error,
    };
    const prevLog = this.parseDamageInsurerMailLog(row.damageInsurerMailLogJson);
    const nextLog = [logItem, ...prevLog].slice(0, 50);

    const currentPipeline = row.damageInsurerPipelineStatus;
    const currentIdx = currentPipeline ? PIPELINE_ORDER.indexOf(currentPipeline) : -1;
    const notifiedIdx = PIPELINE_ORDER.indexOf(DamageInsurerPipelineStatus.notified);
    const nextPipeline =
      currentIdx < notifiedIdx ? DamageInsurerPipelineStatus.notified : currentPipeline;

    const updated = await this.prisma.serviceCase.update({
      where: { id: caseId },
      data: {
        damageInsurerMailLogJson: nextLog as unknown as Prisma.InputJsonValue,
        damageInsurerPipelineStatus: nextPipeline ?? DamageInsurerPipelineStatus.notified,
      },
      include: this.caseInclude(),
    });

    if (row.sourceTicketId) {
      await this.prisma.crmTicketEvent.create({
        data: {
          tenantId: tenant.id,
          ticketId: row.sourceTicketId,
          kind: CrmTicketEventKind.damage_claim_update,
          body:
            status === 'sent'
              ? `Avizare trimisă către asigurător (${to}) — ${selectedDocs.length} doc, ${selectedPhotos.length} poze.`
              : status === 'stubbed'
                ? `Avizare înregistrată (SMTP neconfigurat) — ${to}.`
                : `Avizare către asigurător eșuată — ${error ?? 'eroare'}.`,
          payload: { serviceCaseId: caseId, mail: logItem },
          actorUserId: actorUserId ?? null,
        },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.damage_avizare_send_insurer',
      entityType: 'service_case',
      entityId: caseId,
      meta: {
        to,
        status,
        documentIds: [...docIdSet],
        photoIds: [...photoIdSet],
      },
    });

    if (status === 'failed') {
      throw new BadRequestException(error || 'Trimiterea avizării a eșuat');
    }

    return this.toRecord(updated);
  }

  async requestDamageReinspection(
    tenantSlug: string,
    caseId: string,
    dto: RequestDamageReinspectionInput,
    actorUserId?: string | null,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: {
        vehicle: { select: { registrationNumber: true, brand: true, model: true } },
        workOrders: {
          select: { id: true, supplierId: true, displayNumber: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerWrite(access);
        const partnerWo = row.workOrders.find((w) =>
          allowedSupplierIds(access).includes(w.supplierId ?? ''),
        );
        if (!partnerWo) {
          throw new ForbiddenException('No partner work order on this damage case');
        }
        assertPartnerSupplierId(access, partnerWo.supplierId);
      } else {
        assertServiceCaseWrite(access, row.clientId);
      }
    }
    if (row.workflowType !== ServiceCaseWorkflowType.damage) {
      throw new BadRequestException('Reconstatarea se aplică doar pe workflow daună');
    }
    if (row.damagePayerType === DamagePayerType.client) {
      throw new BadRequestException('Plătitor client — nu se solicită reconstatare');
    }
    // Permis oricând pe pipeline (docs_pending … payment_accepted): avarii ascunse /
    // omisiuni / schimbare soluție tehnică — Norma ASF 20/2017 art. 19 alin. (10)-(11).

    const explanation = dto.note?.trim() || '';
    if (explanation.length < 5) {
      throw new BadRequestException(
        'Completează explicațiile pentru reconstatare (minim 5 caractere)',
      );
    }

    const to = row.damageInsurerEmail?.trim();
    if (!to) {
      throw new BadRequestException('Completează emailul asigurătorului pe dosar');
    }

    const photos = this.parseDamagePhotos(row.damagePhotosJson);
    const photoIdSet = new Set((dto.photoIds ?? []).map((id) => id.trim()).filter(Boolean));
    const selectedPhotos = photos.filter((p) => photoIdSet.has(p.id));
    if (photoIdSet.size > 0 && selectedPhotos.length !== photoIdSet.size) {
      throw new BadRequestException('Unele poze selectate nu mai există pe dosar');
    }

    const webOrigin = (process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
    const absolutize = (url: string) => {
      const u = url.trim();
      if (!u) return u;
      if (/^https?:\/\//i.test(u)) return u;
      if (!webOrigin) return u;
      return `${webOrigin}${u.startsWith('/') ? '' : '/'}${u}`;
    };

    const attachmentLines: string[] = [];
    const attachmentUrls: string[] = [];
    for (const p of selectedPhotos) {
      const abs = absolutize(p.url);
      attachmentUrls.push(abs);
      const kindLabel =
        p.kind === 'exterior'
          ? 'Exterior'
          : p.kind === 'damage_detail'
            ? 'Detaliu avarie'
            : p.kind === 'odometer'
              ? 'Odometru'
              : 'Poză';
      attachmentLines.push(
        `- Poză: ${kindLabel}${p.caption ? ` · ${p.caption}` : ''} — ${abs}`,
      );
    }

    const wo = row.workOrders[0];
    const insurerLabel = row.damageInsurerName?.trim() || 'asigurător';
    const claim = row.damageClaimNumber?.trim() || caseId.slice(-6).toUpperCase();
    const vehicleLabel = [
      row.vehicle?.registrationNumber,
      [row.vehicle?.brand, row.vehicle?.model].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(' · ');
    const prevHistory = this.parseDamageConstatareHistory(row.damageInspectionNotesJson);
    const sequence =
      prevHistory.filter((h) => h.kind === 'reinspection_request').length + 1;
    const subject = `Solicitare reconstatare #${sequence} daună ${claim} — ${row.title}`;
    const mailOpts = await this.resolveDamageMailOptions(
      tenant.id,
      tenant.mailSettings,
      actorUserId,
      row.clientId,
    );
    const bodyLines = [
      `Bună ziua,`,
      ``,
      `Solicităm reconstatare (#${sequence}) pentru dosarul de daună ${claim} (${insurerLabel}).`,
      vehicleLabel ? `Vehicul: ${vehicleLabel}.` : null,
      wo?.displayNumber ? `Comandă service: ${wo.displayNumber}.` : null,
      row.damageInspectionNotePdfUrl
        ? `Notă de constatare existentă pe dosar: ${absolutize(row.damageInspectionNotePdfUrl)}`
        : null,
      ``,
      `Explicații:`,
      explanation,
      attachmentLines.length ? `` : null,
      attachmentLines.length ? `Poze atașate / linkuri:` : null,
      ...attachmentLines,
      ``,
      `Cu stimă,`,
      mailOpts.signature,
    ].filter((l) => l != null) as string[];
    let body = bodyLines.join('\n');

    const fetchUrls = [...attachmentUrls];
    if (row.damageInspectionNotePdfUrl?.trim()) {
      fetchUrls.unshift(absolutize(row.damageInspectionNotePdfUrl));
    }

    let status: DamageInsurerMailLogItem['status'] = 'stubbed';
    let error: string | undefined;
    if (this.partnerMail.isConfigured()) {
      try {
        const attachments = await this.partnerMail.fetchAttachmentsFromUrls(fetchUrls);
        if (attachments.length > 0) {
          body += `\n\n(${attachments.length} fișier(e) atașate acestui email; linkurile de mai sus rămân ca rezervă.)`;
        }
        await this.partnerMail.send({
          to,
          subject,
          body,
          attachments,
          fromName: mailOpts.fromName,
          replyTo: mailOpts.replyTo,
          cc: mailOpts.cc,
        });
        status = 'sent';
      } catch (e) {
        status = 'failed';
        error = e instanceof Error ? e.message : 'SMTP send failed';
      }
    }

    const logItem: DamageInsurerMailLogItem = {
      id: `mail_${Date.now()}`,
      at: new Date().toISOString(),
      direction: 'outbound',
      to,
      subject,
      status,
      kind: 'reinspection',
      note: explanation,
      pdfUrl: row.damageInspectionNotePdfUrl?.trim() || undefined,
      attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
      error,
    };
    const prevLog = this.parseDamageInsurerMailLog(row.damageInsurerMailLogJson);
    const nextLog = [logItem, ...prevLog].slice(0, 50);

    const requestItem: DamageReinspectionRequestItem = {
      id: `recon_${Date.now()}`,
      kind: 'reinspection_request',
      sequence,
      status: 'pending',
      explanation,
      photoIds: selectedPhotos.map((p) => p.id),
      sentAt: logItem.at,
      mailLogId: logItem.id,
    };
    const nextHistory = [requestItem, ...prevHistory].slice(0, 50);

    const current = row.damageInsurerPipelineStatus;
    const nextPipeline =
      current === DamageInsurerPipelineStatus.payment_accepted
        ? current
        : DamageInsurerPipelineStatus.reinspection_requested;

    const updated = await this.prisma.serviceCase.update({
      where: { id: caseId },
      data: {
        damageInsurerMailLogJson: nextLog as unknown as Prisma.InputJsonValue,
        damageInspectionNotesJson: nextHistory as unknown as Prisma.InputJsonValue,
        damageInsurerPipelineStatus: nextPipeline,
      },
      include: this.caseInclude(),
    });

    if (row.sourceTicketId) {
      await this.prisma.crmTicketEvent.create({
        data: {
          tenantId: tenant.id,
          ticketId: row.sourceTicketId,
          kind: CrmTicketEventKind.damage_claim_update,
          body:
            status === 'sent'
              ? `Reconstatare #${sequence} solicitată către asigurător (${to}).`
              : status === 'stubbed'
                ? `Reconstatare #${sequence} înregistrată (SMTP neconfigurat) — ${to}.`
                : `Solicitare reconstatare eșuată — ${error ?? 'eroare'}.`,
          payload: { serviceCaseId: caseId, mail: logItem, request: requestItem },
          actorUserId: actorUserId ?? null,
        },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.damage_reinspection_request',
      entityType: 'service_case',
      entityId: caseId,
      meta: {
        to,
        status,
        sequence,
        photoIds: requestItem.photoIds,
        requestId: requestItem.id,
      },
    });

    if (status === 'failed') {
      throw new BadRequestException(error || 'Solicitarea de reconstatare a eșuat');
    }

    return this.toRecord(updated);
  }

  async decideDamageReinspection(
    tenantSlug: string,
    caseId: string,
    dto: DecideDamageReinspectionInput,
    actorUserId?: string | null,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: {
        workOrders: {
          select: { id: true, supplierId: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerWrite(access);
        const partnerWo = row.workOrders.find((w) =>
          allowedSupplierIds(access).includes(w.supplierId ?? ''),
        );
        if (!partnerWo) {
          throw new ForbiddenException('No partner work order on this damage case');
        }
        assertPartnerSupplierId(access, partnerWo.supplierId);
      } else {
        assertServiceCaseWrite(access, row.clientId);
      }
    }
    if (row.workflowType !== ServiceCaseWorkflowType.damage) {
      throw new BadRequestException('Reconstatarea se aplică doar pe workflow daună');
    }

    const decision = dto.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new BadRequestException('decision must be approved or rejected');
    }
    const requestId = dto.requestId?.trim();
    if (!requestId) {
      throw new BadRequestException('requestId is required');
    }
    if (decision === 'rejected') {
      const reason = dto.rejectionReason?.trim() || '';
      if (reason.length < 3) {
        throw new BadRequestException('Motivul refuzului e obligatoriu (minim 3 caractere)');
      }
    }
    const approvalUrl =
      decision === 'approved' ? dto.approvalDocumentUrl?.trim() || '' : '';
    const approvalFileName =
      decision === 'approved'
        ? dto.approvalDocumentFileName?.trim() || null
        : null;
    if (decision === 'approved' && !approvalUrl) {
      throw new BadRequestException(
        'La aprobare încarcă documentul de la asigurător (PDF/aprobare/PVS)',
      );
    }

    const history = this.parseDamageConstatareHistory(row.damageInspectionNotesJson);
    const idx = history.findIndex(
      (h) => h.kind === 'reinspection_request' && h.id === requestId,
    );
    if (idx < 0) {
      throw new BadRequestException('Cererea de reconstatare nu a fost găsită');
    }
    const req = history[idx] as DamageReinspectionRequestItem;
    if (req.status !== 'pending') {
      throw new BadRequestException('Cererea nu mai este în așteptare');
    }

    const decidedAt = new Date().toISOString();
    let nextHistory = [...history];
    let linkedPvsId: string | undefined;

    if (decision === 'approved') {
      const pvsSequence =
        history.filter((h): h is DamageInspectionNoteItem => h.kind === 'pvs').length + 1;
      linkedPvsId = `pvs_${Date.now()}`;
      const pvsEntry: DamageInspectionNoteItem = {
        id: linkedPvsId,
        kind: 'pvs',
        sequence: pvsSequence,
        requestId,
        pdfUrl: approvalUrl,
        fileName: approvalFileName ?? undefined,
        receivedAt: decidedAt,
        notes: `Document aprobare reconstatare #${req.sequence}`,
      };
      const updatedReq: DamageReinspectionRequestItem = {
        ...req,
        status: 'approved',
        decidedAt,
        approvalDocUrl: approvalUrl,
        approvalDocFileName: approvalFileName ?? undefined,
        linkedPvsId,
        rejectionReason: undefined,
      };
      nextHistory[idx] = updatedReq;
      nextHistory = [pvsEntry, ...nextHistory].slice(0, 50);
    } else {
      const rejectedReq: DamageReinspectionRequestItem = {
        ...req,
        status: 'rejected',
        decidedAt,
        rejectionReason: dto.rejectionReason!.trim(),
        approvalDocUrl: undefined,
        approvalDocFileName: undefined,
      };
      nextHistory[idx] = rejectedReq;
    }

    const hasPending = nextHistory.some(
      (h) => h.kind === 'reinspection_request' && h.status === 'pending',
    );
    let nextPipeline = row.damageInsurerPipelineStatus;
    if (decision === 'approved') {
      nextPipeline = DamageInsurerPipelineStatus.inspection_note;
    } else if (decision === 'rejected' && !hasPending) {
      if (nextPipeline === DamageInsurerPipelineStatus.reinspection_requested) {
        nextPipeline = DamageInsurerPipelineStatus.inspection_note;
      }
    }

    const updated = await this.prisma.serviceCase.update({
      where: { id: caseId },
      data: {
        damageInspectionNotesJson: nextHistory as unknown as Prisma.InputJsonValue,
        damageInsurerPipelineStatus: nextPipeline,
        ...(decision === 'approved'
          ? {
              damageInspectionNotePdfUrl: approvalUrl,
              damageInspectionNoteFileName: approvalFileName,
              damageInspectionNoteReceivedAt: new Date(decidedAt),
            }
          : {}),
      },
      include: this.caseInclude(),
    });

    if (row.sourceTicketId) {
      await this.prisma.crmTicketEvent.create({
        data: {
          tenantId: tenant.id,
          ticketId: row.sourceTicketId,
          kind: CrmTicketEventKind.damage_claim_update,
          body:
            decision === 'approved'
              ? `Reconstatare #${req.sequence} aprobată — document asigurător înregistrat (PVS${
                  history.filter((h) => h.kind === 'pvs').length + 1
                }).`
              : `Reconstatare #${req.sequence} respinsă: ${dto.rejectionReason!.trim()}`,
          payload: {
            serviceCaseId: caseId,
            requestId,
            decision,
            linkedPvsId: linkedPvsId ?? null,
          },
          actorUserId: actorUserId ?? null,
        },
      });
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_case.damage_reinspection_decide',
      entityType: 'service_case',
      entityId: caseId,
      meta: {
        requestId,
        decision,
        sequence: req.sequence,
        linkedPvsId: linkedPvsId ?? null,
        hasApprovalDoc: Boolean(approvalUrl),
      },
    });

    return this.toRecord(updated);
  }

  /**
   * Aliniază quote WO + Lucrare gata cu pipeline-ul de daună:
   * - quote_ready → quote submitted (sau stub)
   * - payment_accepted / agreed → quote approved
   * - poze `repaired` + aprobare asigurător → readyAt (Lucrare gata)
   */
  private async syncWorkOrdersFromDamageClaim(
    tenantId: string,
    caseId: string,
    snapshot: {
      workflowType: ServiceCaseWorkflowType;
      damageInsurerPipelineStatus: DamageInsurerPipelineStatus | null;
      damagePhotosJson: unknown;
      damageInsurerAgreedAt: Date | null;
      sourceTicketId: string | null;
    },
    actorUserId?: string | null,
  ): Promise<void> {
    if (snapshot.workflowType !== ServiceCaseWorkflowType.damage) return;

    const rank = snapshot.damageInsurerPipelineStatus
      ? PIPELINE_ORDER.indexOf(snapshot.damageInsurerPipelineStatus)
      : -1;
    const quoteReadyRank = PIPELINE_ORDER.indexOf(DamageInsurerPipelineStatus.quote_ready);
    const paymentRank = PIPELINE_ORDER.indexOf(DamageInsurerPipelineStatus.payment_accepted);
    const insurerApproved =
      rank >= paymentRank || !!snapshot.damageInsurerAgreedAt;
    const photos = this.parseDamagePhotos(snapshot.damagePhotosJson);
    const hasRepaired = photos.some((p) => p.kind === 'repaired');

    if (rank < quoteReadyRank && !insurerApproved && !hasRepaired) return;

    const wos = await this.prisma.maintenanceWorkOrder.findMany({
      where: { serviceCaseId: caseId, tenantId },
      include: {
        quotes: {
          orderBy: { version: 'desc' },
          include: { lines: { select: { id: true } } },
        },
      },
    });

    for (const wo of wos) {
      let primary = wo.quotes[0] ?? null;

      if (rank >= quoteReadyRank || insurerApproved) {
        if (!primary) {
          primary = await this.prisma.workOrderQuote.create({
            data: {
              tenantId,
              workOrderId: wo.id,
              version: 1,
              status: insurerApproved
                ? WorkOrderQuoteStatus.approved
                : WorkOrderQuoteStatus.submitted,
              submittedAt: new Date(),
              approvedAt: insurerApproved ? new Date() : null,
              approvedByUserId: insurerApproved ? actorUserId ?? null : null,
              notes: 'Sincronizat din dosarul de daună (deviz / accept asigurător)',
              lines: {
                create: [
                  {
                    tenantId,
                    sortOrder: 0,
                    lineType: WorkOrderQuoteLineType.other,
                    description: 'Deviz / referință asigurător (dosar daună)',
                    quantity: 1,
                    unitNetCents: 0,
                    vatRatePercent: 0,
                    approvalStatus: insurerApproved
                      ? WorkOrderQuoteLineApproval.approved
                      : WorkOrderQuoteLineApproval.pending,
                  },
                ],
              },
            },
            include: { lines: { select: { id: true } } },
          });
        } else if (primary.status === WorkOrderQuoteStatus.draft) {
          await this.prisma.workOrderQuote.update({
            where: { id: primary.id },
            data: {
              status: insurerApproved
                ? WorkOrderQuoteStatus.approved
                : WorkOrderQuoteStatus.submitted,
              submittedAt: primary.submittedAt ?? new Date(),
              approvedAt: insurerApproved ? new Date() : primary.approvedAt,
              approvedByUserId: insurerApproved
                ? actorUserId ?? null
                : primary.approvedByUserId,
              approvedNetCents: insurerApproved ? primary.totalNetCents : primary.approvedNetCents,
              approvedVatCents: insurerApproved ? primary.totalVatCents : primary.approvedVatCents,
            },
          });
          if (insurerApproved && primary.lines.length) {
            await this.prisma.workOrderQuoteLine.updateMany({
              where: { quoteId: primary.id },
              data: { approvalStatus: WorkOrderQuoteLineApproval.approved },
            });
          }
          primary = {
            ...primary,
            status: insurerApproved
              ? WorkOrderQuoteStatus.approved
              : WorkOrderQuoteStatus.submitted,
          };
        } else if (
          insurerApproved &&
          primary.status === WorkOrderQuoteStatus.submitted
        ) {
          await this.prisma.workOrderQuote.update({
            where: { id: primary.id },
            data: {
              status: WorkOrderQuoteStatus.approved,
              approvedAt: new Date(),
              approvedByUserId: actorUserId ?? null,
              approvedNetCents: primary.totalNetCents,
              approvedVatCents: primary.totalVatCents,
            },
          });
          if (primary.lines.length) {
            await this.prisma.workOrderQuoteLine.updateMany({
              where: { quoteId: primary.id },
              data: { approvalStatus: WorkOrderQuoteLineApproval.approved },
            });
          }
          primary = { ...primary, status: WorkOrderQuoteStatus.approved };
        }

        if (insurerApproved) {
          await this.prisma.serviceCase.update({
            where: { id: caseId },
            data: {
              awaitingPostApproval: true,
              currentStage: ServiceCaseStage.approval,
            },
          });
        }
      }

      if (hasRepaired && insurerApproved && !wo.readyAt) {
        const readyAt = new Date();
        await this.prisma.maintenanceWorkOrder.update({
          where: { id: wo.id },
          data: { readyAt },
        });
        if (snapshot.sourceTicketId) {
          await this.prisma.crmTicketEvent.create({
            data: {
              tenantId,
              ticketId: snapshot.sourceTicketId,
              kind: CrmTicketEventKind.workflow_advance,
              body: `Lucrare gata (automat) — poze auto reparat pe dosar (${readyAt.toLocaleString('ro-RO')}).`,
              payload: {
                workOrderId: wo.id,
                readyAt: readyAt.toISOString(),
                milestone: 'work_ready',
                source: 'damage_repaired_photos',
              },
              actorUserId: actorUserId ?? null,
            },
          });
        }
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'work_order.mark_ready_auto_repaired_photos',
          entityType: 'maintenance_work_order',
          entityId: wo.id,
          meta: { readyAt: readyAt.toISOString(), serviceCaseId: caseId },
        });
      }
    }
  }

  private assertDamageSectionKey(section: string): DamageSectionKey {
    if (!DAMAGE_SECTION_KEYS.includes(section as DamageSectionKey)) {
      throw new BadRequestException(
        `lockSection.section must be one of: ${DAMAGE_SECTION_KEYS.join(', ')}`,
      );
    }
    return section as DamageSectionKey;
  }

  private assertUnlockedForPatch(locks: DamageSectionLocks, dto: PatchDamageClaimInput) {
    const touches: Partial<Record<DamageSectionKey, boolean>> = {
      claim_info:
        dto.vehicleMovable !== undefined ||
        dto.damageEventOn !== undefined ||
        dto.damageInsuranceType !== undefined ||
        dto.damageClaimNumber !== undefined ||
        dto.damageInsurerName !== undefined ||
        dto.damageInsurerId !== undefined ||
        dto.damageClaimStatus !== undefined ||
        dto.damagePayerType !== undefined ||
        dto.damageInsurerAgreementNotes !== undefined ||
        dto.damageCascoFranchiseCents !== undefined ||
        dto.damageInsurerEmail !== undefined ||
        dto.damageQuoteOrigin !== undefined ||
        dto.damageInsurerQuotePdfUrl !== undefined ||
        dto.damageInspectionMode !== undefined ||
        dto.damageInspectionNotePdfUrl !== undefined ||
        dto.damageInspectionNoteFileName !== undefined ||
        dto.damageInspectionNoteIssuedOn !== undefined ||
        dto.damageInspectionNoteNotes !== undefined ||
        dto.damagePaymentAcceptancePdfUrl !== undefined ||
        dto.damagePaymentAcceptanceFileName !== undefined ||
        dto.damagePaymentAcceptanceNotes !== undefined,
      documents: dto.damageDocuments !== undefined,
      photos: dto.damagePhotos !== undefined,
      pipeline:
        dto.damageInsurerPipelineStatus !== undefined ||
        dto.agreeInsurer !== undefined ||
        dto.clientPayerConfirmed !== undefined,
    };
    for (const key of DAMAGE_SECTION_KEYS) {
      if (!touches[key] || !locks[key]) continue;
      const unlocking =
        dto.lockSection?.section === key && dto.lockSection.lock === false;
      if (!unlocking) {
        throw new BadRequestException(
          `Section "${key}" is locked and cannot be edited until unlocked`,
        );
      }
    }
  }

  private async ensureDraftRoadsideForImmovable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceCase: {
      id: string;
      clientId: string;
      vehicleId: string | null;
      sourceTicketId: string | null;
    },
  ) {
    const existing = await tx.roadsideIntervention.findFirst({
      where: {
        tenantId,
        serviceCaseId: serviceCase.id,
        status: { not: RoadsideInterventionStatus.cancelled },
      },
      select: { id: true },
    });
    if (existing) return;

    const now = new Date();
    const displayNumber = await nextRoadsideDisplayNumber(tx, tenantId, now);
    await tx.roadsideIntervention.create({
      data: {
        tenantId,
        displayNumber,
        serviceCaseId: serviceCase.id,
        sourceTicketId: serviceCase.sourceTicketId,
        clientId: serviceCase.clientId,
        vehicleId: serviceCase.vehicleId,
        kind: RoadsideInterventionKind.tow,
        status: RoadsideInterventionStatus.draft,
        notes: 'Auto-draft: vehicul imobil — asistență rutieră necesară',
      },
    });
  }

  async createAppointment(
    tenantSlug: string,
    caseId: string,
    dto: CreateServiceAppointmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceAppointmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const serviceCase = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: { sourceTicket: true },
    });
    if (!serviceCase) throw new NotFoundException('Service case not found');
    if (!serviceCase.vehicleId) {
      throw new BadRequestException('Service case has no vehicle — cannot schedule');
    }
    if (access) assertServiceCaseWrite(access, serviceCase.clientId);

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }

    let supplierId = serviceCase.supplierId;
    if (dto.supplierId !== undefined) {
      if (dto.supplierId) {
        await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
        supplierId = dto.supplierId;
      } else {
        supplierId = null;
      }
    }

    const durationMin = dto.durationMin ?? 60;
    if (!Number.isInteger(durationMin) || durationMin < 15) {
      throw new BadRequestException('Invalid durationMin');
    }

    const initialStatus =
      dto.status ??
      resolveInitialAppointmentStatus(supplierId, dto.createdBySupplier);
    const proposedByRole =
      initialStatus === ServiceAppointmentStatus.pending_supplier
        ? proposedByFromAccess(access)
        : dto.createdBySupplier
          ? ServiceAppointmentProposedBy.supplier
          : null;

    const appointment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceAppointment.create({
        data: {
          tenantId: tenant.id,
          serviceCaseId: caseId,
          vehicleId: serviceCase.vehicleId!,
          supplierId,
          title: dto.title?.trim() || serviceCase.title,
          scheduledAt,
          durationMin,
          location: dto.location?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: initialStatus,
          proposedByRole,
        },
        include: { supplier: { select: { legalName: true } } },
      });

      const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(serviceCase.currentStage);
      const scheduledIdx = SERVICE_CASE_STAGE_ORDER.indexOf(ServiceCaseStage.scheduled);
      if (currentIdx < scheduledIdx) {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: { currentStage: ServiceCaseStage.scheduled, supplierId },
        });
        if (serviceCase.sourceTicketId) {
          await tx.crmTicketEvent.create({
            data: {
              tenantId: tenant.id,
              ticketId: serviceCase.sourceTicketId,
              kind: CrmTicketEventKind.workflow_advance,
              body: `Programare stabilită: ${scheduledAt.toLocaleString('ro-RO')}.`,
              payload: {
                fromStage: serviceCase.currentStage,
                toStage: ServiceCaseStage.scheduled,
                serviceCaseId: caseId,
                appointmentId: created.id,
              },
              actorUserId: actorUserId ?? null,
            },
          });
        }
      } else if (supplierId !== serviceCase.supplierId) {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: { supplierId },
        });
      }

      await tx.maintenanceWorkOrder.updateMany({
        where: { serviceCaseId: caseId },
        data: { plannedAt: scheduledAt, supplierId },
      });

      return created;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.create',
      entityType: 'service_appointment',
      entityId: appointment.id,
      meta: { serviceCaseId: caseId },
    });

    return this.toAppointmentRecord(appointment);
  }

  async updateAppointment(
    tenantSlug: string,
    appointmentId: string,
    dto: UpdateServiceAppointmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceAppointmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: { include: { sourceTicket: true } } },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    if (access) assertServiceCaseWrite(access, existing.serviceCase.clientId);

    let supplierId = existing.supplierId;
    if (dto.supplierId !== undefined) {
      if (dto.supplierId) {
        await resolveSupplierInTenant(this.prisma, tenant.id, dto.supplierId);
        supplierId = dto.supplierId;
      } else {
        supplierId = null;
      }
    }

    const data: Prisma.ServiceAppointmentUpdateInput = {};
    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Invalid scheduledAt');
      data.scheduledAt = scheduledAt;
    }
    if (dto.location !== undefined) data.location = dto.location?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.supplierId !== undefined) {
      data.supplier = supplierId
        ? { connect: { id: supplierId } }
        : { disconnect: true };
    }

    const appointment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data,
        include: { supplier: { select: { legalName: true } } },
      });

      if (dto.scheduledAt !== undefined || dto.supplierId !== undefined) {
        await tx.maintenanceWorkOrder.updateMany({
          where: { serviceCaseId: existing.serviceCaseId },
          data: {
            ...(dto.scheduledAt !== undefined ? { plannedAt: updated.scheduledAt } : {}),
            ...(dto.supplierId !== undefined ? { supplierId } : {}),
          },
        });
        if (dto.supplierId !== undefined) {
          await tx.serviceCase.update({
            where: { id: existing.serviceCaseId },
            data: { supplierId },
          });
        }
      }

      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.update',
      entityType: 'service_appointment',
      entityId: appointmentId,
      meta: { serviceCaseId: existing.serviceCaseId },
    });

    return this.toAppointmentRecord(appointment);
  }

  async confirmAppointment(
    tenantSlug: string,
    appointmentId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (existing.status === ServiceAppointmentStatus.cancelled) {
      throw new BadRequestException('Cannot confirm cancelled appointment');
    }
    if (
      existing.status === ServiceAppointmentStatus.needs_repropose ||
      existing.driverDeclinedAt
    ) {
      throw new BadRequestException(
        'Programarea a fost refuzată de șofer — propuneți o nouă dată.',
      );
    }
    if (existing.status === ServiceAppointmentStatus.pending_supplier) {
      throw new BadRequestException(
        'Programarea trebuie validată de furnizor înainte de confirmare.',
      );
    }
    if (access && !canConfirmAppointment(access, existing.serviceCase.clientId)) {
      throw new ForbiddenException('Cannot confirm appointment');
    }

    let woCreated: { created: boolean; workOrderId: string | null } = {
      created: false,
      workOrderId: null,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: {
          status: ServiceAppointmentStatus.confirmed,
          managerConfirmedAt: new Date(),
        },
      });

      const serviceCase = await tx.serviceCase.findFirst({ where: { id: existing.serviceCaseId } });
      if (serviceCase?.sourceTicketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `Programare confirmată de manager: ${existing.scheduledAt.toLocaleString('ro-RO')}.`,
            payload: { appointmentId, serviceCaseId: serviceCase.id },
            actorUserId: actorUserId ?? null,
          },
        });
      }

      woCreated = await this.maybeCreateWorkOrderAfterDualConfirmTx(
        tx,
        tenant.id,
        appointmentId,
        existing.scheduledAt,
        existing.supplierId ?? existing.serviceCase.supplierId,
        actorUserId,
      );
    });

    if (woCreated.created) {
      void this.partnerNotify.notifySupplierContact(
        tenant.id,
        existing.supplierId ?? existing.serviceCase.supplierId,
        'wo_created',
        `Comandă service nouă — ${existing.serviceCase.title}`,
        `S-a creat comanda de lucru după confirmarea programării.`,
        {
          appointmentId,
          serviceCaseId: existing.serviceCaseId,
          workOrderId: woCreated.workOrderId,
        },
      );
    }

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async supplierValidateAppointment(
    tenantSlug: string,
    appointmentId: string,
    dto: SupplierValidateAppointmentInput = {},
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    const canValidate =
      existing.status === ServiceAppointmentStatus.pending_supplier ||
      existing.status === ServiceAppointmentStatus.needs_repropose;
    if (!canValidate) {
      throw new BadRequestException('Appointment is not awaiting supplier validation');
    }
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerWrite(access);
        assertPartnerSupplierId(access, existing.supplierId);
      } else {
        assertServiceCaseWrite(access, existing.serviceCase.clientId);
      }
    }

    let scheduledAt = existing.scheduledAt;
    let durationMin = existing.durationMin;
    if (dto.scheduledAt) {
      const next = new Date(dto.scheduledAt);
      if (Number.isNaN(next.getTime())) {
        throw new BadRequestException('Invalid scheduledAt');
      }
      scheduledAt = next;
    }
    if (dto.durationMin !== undefined) {
      if (!Number.isInteger(dto.durationMin) || dto.durationMin < 15 || dto.durationMin > 24 * 60) {
        throw new BadRequestException('durationMin must be between 15 and 1440');
      }
      durationMin = dto.durationMin;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: {
          status: ServiceAppointmentStatus.scheduled,
          supplierValidatedAt: new Date(),
          scheduledAt,
          durationMin,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
          managerConfirmedAt: null,
          driverAcknowledgedAt: null,
          driverDeclinedAt: null,
          driverDeclineNote: null,
        },
      });

      await tx.maintenanceWorkOrder.updateMany({
        where: { serviceCaseId: existing.serviceCaseId },
        data: { plannedAt: scheduledAt },
      });

      if (existing.serviceCase.sourceTicketId) {
        const body = dto.scheduledAt
          ? `Furnizorul a acceptat cu altă dată: ${scheduledAt.toLocaleString('ro-RO')}.`
          : `Furnizorul a validat programarea: ${scheduledAt.toLocaleString('ro-RO')}.`;
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: existing.serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body,
            payload: { appointmentId, serviceCaseId: existing.serviceCaseId, supplierValidated: true },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.supplier_validate',
      entityType: 'service_appointment',
      entityId: appointmentId,
      meta: { serviceCaseId: existing.serviceCaseId },
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async requestCancelAppointment(
    tenantSlug: string,
    appointmentId: string,
    dto: RequestCancelAppointmentInput = {},
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true, vehicle: { select: { registrationNumber: true } } },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    if (
      existing.status === ServiceAppointmentStatus.cancelled ||
      existing.status === ServiceAppointmentStatus.completed
    ) {
      throw new BadRequestException('Appointment is already closed');
    }
    if (existing.cancellationRequestedAt) {
      throw new BadRequestException('Cancellation already requested');
    }

    if (!access || !isPartnerUser(access)) {
      throw new ForbiddenException('Only supplier partners can request cancellation');
    }
    assertPartnerWrite(access);
    assertPartnerSupplierId(access, existing.supplierId);

    const note = dto.note?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: {
          cancellationRequestedAt: new Date(),
          cancellationRequestNote: note,
        },
      });

      if (existing.serviceCase.sourceTicketId) {
        const when = existing.scheduledAt.toLocaleString('ro-RO');
        const reg = existing.vehicle.registrationNumber;
        const body = note
          ? `Furnizorul solicită anularea programării (${reg}, ${when}): ${note}`
          : `Furnizorul solicită anularea programării (${reg}, ${when}).`;
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: existing.serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body,
            payload: {
              appointmentId,
              serviceCaseId: existing.serviceCaseId,
              cancellationRequested: true,
              note,
            },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.request_cancel',
      entityType: 'service_appointment',
      entityId: appointmentId,
      meta: { serviceCaseId: existing.serviceCaseId, note },
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async acknowledgeAppointment(
    tenantSlug: string,
    appointmentId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (access && !canAckAppointmentAsDriver(access, existing.serviceCase.clientId)) {
      throw new ForbiddenException('Cannot acknowledge appointment');
    }
    if (
      existing.status === ServiceAppointmentStatus.needs_repropose ||
      existing.driverDeclinedAt
    ) {
      throw new BadRequestException('Appointment was declined — awaiting manager reproposal');
    }

    let woCreated: { created: boolean; workOrderId: string | null } = {
      created: false,
      workOrderId: null,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: { driverAcknowledgedAt: new Date() },
      });

      woCreated = await this.maybeCreateWorkOrderAfterDualConfirmTx(
        tx,
        tenant.id,
        appointmentId,
        existing.scheduledAt,
        existing.supplierId ?? existing.serviceCase.supplierId,
        actorUserId,
      );
    });

    if (woCreated.created) {
      const tenantRow = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenantRow) {
        void this.partnerNotify.notifySupplierContact(
          tenantRow.id,
          existing.supplierId ?? existing.serviceCase.supplierId,
          'wo_created',
          `Comandă service nouă — ${existing.serviceCase.title}`,
          `S-a creat comanda de lucru după confirmarea șoferului.`,
          {
            appointmentId,
            serviceCaseId: existing.serviceCaseId,
            workOrderId: woCreated.workOrderId,
          },
        );
      }
    }

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async declineAppointment(
    tenantSlug: string,
    appointmentId: string,
    dto: DeclineAppointmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (access && !canAckAppointmentAsDriver(access, existing.serviceCase.clientId)) {
      throw new ForbiddenException('Cannot decline appointment');
    }

    const note = dto.note?.trim() ?? '';
    if (note.length < 3) {
      throw new BadRequestException('Decline note is required (min 3 characters)');
    }

    if (!existing.managerConfirmedAt) {
      throw new BadRequestException('Appointment is not manager-confirmed yet');
    }
    if (existing.driverAcknowledgedAt) {
      throw new BadRequestException('Appointment already acknowledged by driver');
    }
    if (existing.driverDeclinedAt || existing.status === ServiceAppointmentStatus.needs_repropose) {
      throw new BadRequestException('Appointment already declined');
    }
    const declineAllowed =
      existing.status === ServiceAppointmentStatus.confirmed ||
      (existing.status === ServiceAppointmentStatus.scheduled && !!existing.managerConfirmedAt);
    if (!declineAllowed) {
      throw new BadRequestException('Appointment cannot be declined in current status');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: {
          status: ServiceAppointmentStatus.needs_repropose,
          driverDeclinedAt: new Date(),
          driverDeclineNote: note,
          managerConfirmedAt: null,
          driverAcknowledgedAt: null,
        },
      });

      if (existing.serviceCase.sourceTicketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: existing.serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `Șoferul a refuzat programarea (${existing.scheduledAt.toLocaleString('ro-RO')}): ${note}`,
            payload: {
              appointmentId,
              serviceCaseId: existing.serviceCaseId,
              driverDeclined: true,
              note,
            },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.decline',
      entityType: 'service_appointment',
      entityId: appointmentId,
      meta: { serviceCaseId: existing.serviceCaseId, note },
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async reproposeAppointment(
    tenantSlug: string,
    appointmentId: string,
    dto: ReproposeAppointmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.serviceAppointment.findFirst({
      where: { id: appointmentId, tenantId: tenant.id },
      include: { serviceCase: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (access) assertServiceCaseWrite(access, existing.serviceCase.clientId);

    const canRepropose =
      existing.status === ServiceAppointmentStatus.needs_repropose ||
      !!existing.driverDeclinedAt;
    if (!canRepropose) {
      throw new BadRequestException('Appointment is not awaiting reproposal');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }

    let durationMin = existing.durationMin;
    if (dto.durationMin !== undefined) {
      if (!Number.isInteger(dto.durationMin) || dto.durationMin < 15 || dto.durationMin > 24 * 60) {
        throw new BadRequestException('durationMin must be between 15 and 1440');
      }
      durationMin = dto.durationMin;
    }

    const proposalNote = dto.note?.trim() || null;
    const priorDeclineNote = existing.driverDeclineNote;
    const nextStatus = existing.supplierId
      ? ServiceAppointmentStatus.pending_supplier
      : ServiceAppointmentStatus.scheduled;

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAppointment.update({
        where: { id: appointmentId },
        data: {
          scheduledAt,
          durationMin,
          status: nextStatus,
          lastProposalNote: proposalNote,
          driverDeclinedAt: null,
          driverDeclineNote: null,
          managerConfirmedAt: null,
          driverAcknowledgedAt: null,
          supplierValidatedAt: null,
          proposedByRole: nextStatus === ServiceAppointmentStatus.pending_supplier
            ? proposedByFromAccess(access)
            : existing.proposedByRole,
        },
      });

      await tx.maintenanceWorkOrder.updateMany({
        where: { serviceCaseId: existing.serviceCaseId },
        data: { plannedAt: scheduledAt },
      });

      if (existing.serviceCase.sourceTicketId) {
        const body = proposalNote
          ? `Managerul a repropus programarea: ${scheduledAt.toLocaleString('ro-RO')}. ${proposalNote}`
          : `Managerul a repropus programarea: ${scheduledAt.toLocaleString('ro-RO')}.`;
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: existing.serviceCase.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body,
            payload: {
              appointmentId,
              serviceCaseId: existing.serviceCaseId,
              reproposed: true,
              note: proposalNote,
              priorDeclineNote,
              scheduledAt: scheduledAt.toISOString(),
              status: nextStatus,
            },
            actorUserId: actorUserId ?? null,
          },
        });
      }
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'service_appointment.repropose',
      entityType: 'service_appointment',
      entityId: appointmentId,
      meta: { serviceCaseId: existing.serviceCaseId, scheduledAt: scheduledAt.toISOString(), note: proposalNote },
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: existing.serviceCaseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  async applyPostApproval(
    tenantSlug: string,
    caseId: string,
    dto: PostApprovalInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<ServiceCaseRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.serviceCase.findFirst({
      where: { id: caseId, tenantId: tenant.id },
      include: { sourceTicket: true, workOrders: { select: { supplierId: true } } },
    });
    if (!row) throw new NotFoundException('Service case not found');
    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerWrite(access);
        const ownsWo = row.workOrders.some((wo) => {
          try {
            assertPartnerSupplierId(access, wo.supplierId);
            return true;
          } catch {
            return false;
          }
        });
        if (!ownsWo) {
          throw new ForbiddenException('Partenerul nu poate decide pe acest dosar');
        }
      } else {
        assertServiceCaseWrite(access, row.clientId);
      }
    }
    if (!row.awaitingPostApproval) {
      throw new BadRequestException('Service case is not awaiting post-approval decision');
    }

    const path = dto.path === 'reschedule' ? PostApprovalPath.reschedule : PostApprovalPath.immediate;

    if (path === PostApprovalPath.immediate) {
      await assertDamageReadyForRepair(this.prisma, tenant.id, {
        id: row.id,
        workflowType: row.workflowType,
        damagePayerType: row.damagePayerType,
        damageInsurerPipelineStatus: row.damageInsurerPipelineStatus,
        damageInsurerAgreedAt: row.damageInsurerAgreedAt,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (path === PostApprovalPath.immediate) {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: {
            awaitingPostApproval: false,
            postApprovalPath: PostApprovalPath.immediate,
            currentStage: ServiceCaseStage.work_order,
          },
        });
      } else {
        await tx.serviceCase.update({
          where: { id: caseId },
          data: {
            awaitingPostApproval: false,
            postApprovalPath: PostApprovalPath.reschedule,
            currentStage: ServiceCaseStage.scheduled,
          },
        });
      }

      if (row.sourceTicketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId: row.sourceTicketId,
            kind: CrmTicketEventKind.workflow_advance,
            body:
              path === PostApprovalPath.immediate
                ? 'Deviz aprobat — execuție reparație (factură apoi cost).'
                : 'Deviz aprobat — reprogramare service (fără deviz nou).',
            payload: { serviceCaseId: caseId, postApprovalPath: path },
            actorUserId: actorUserId ?? null,
          },
        });
      }

      const wo = await tx.maintenanceWorkOrder.findFirst({ where: { serviceCaseId: caseId } });
      if (wo) {
        await tx.maintenanceWorkOrder.update({
          where: { id: wo.id },
          data: {
            repairPathNote:
              path === PostApprovalPath.immediate
                ? 'Reparație directă după aprobare deviz'
                : 'Reparație cu reprogramare după aprobare deviz',
            ...(path === PostApprovalPath.immediate &&
            (wo.status === MaintenanceWorkOrderStatus.draft ||
              wo.status === MaintenanceWorkOrderStatus.sent ||
              wo.status === MaintenanceWorkOrderStatus.waiting_parts)
              ? { status: MaintenanceWorkOrderStatus.in_progress }
              : {}),
          },
        });
      }
    });

    const reloaded = await this.prisma.serviceCase.findFirst({
      where: { id: caseId },
      include: this.caseInclude(),
    });
    return this.toRecord(reloaded!);
  }

  private async maybeCreateWorkOrderAfterDualConfirmTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    appointmentId: string,
    scheduledAt: Date,
    supplierId: string | null,
    actorUserId?: string,
  ): Promise<{ created: boolean; workOrderId: string | null }> {
    const appt = await tx.serviceAppointment.findFirst({ where: { id: appointmentId } });
    if (!appt?.managerConfirmedAt || !appt?.driverAcknowledgedAt) {
      return { created: false, workOrderId: null };
    }
    if (appt.status !== ServiceAppointmentStatus.confirmed) {
      return { created: false, workOrderId: null };
    }

    const serviceCase = await tx.serviceCase.findFirst({ where: { id: appt.serviceCaseId } });
    if (!serviceCase?.vehicleId) return { created: false, workOrderId: null };

    const prior = await tx.maintenanceWorkOrder.findFirst({
      where: { serviceCaseId: serviceCase.id },
    });

    const wo = await this.ensureWorkOrderTx(
      tx,
      tenantId,
      serviceCase,
      supplierId ?? serviceCase.supplierId,
      actorUserId,
    );

    const workOrderIdx = SERVICE_CASE_STAGE_ORDER.indexOf(ServiceCaseStage.work_order);
    const currentIdx = SERVICE_CASE_STAGE_ORDER.indexOf(serviceCase.currentStage);
    if (currentIdx < workOrderIdx) {
      await tx.serviceCase.update({
        where: { id: serviceCase.id },
        data: { currentStage: ServiceCaseStage.work_order },
      });
    }

    await tx.maintenanceWorkOrder.updateMany({
      where: { serviceCaseId: serviceCase.id },
      data: { plannedAt: scheduledAt, supplierId: supplierId ?? serviceCase.supplierId },
    });

    return { created: !prior, workOrderId: wo.id };
  }

  private async ensureWorkOrder(
    tenantId: string,
    serviceCase: {
      id: string;
      vehicleId: string | null;
      title: string;
      sourceTicketId: string | null;
      workflowType: ServiceCaseWorkflowType;
    },
    supplierId: string | null,
    actorUserId?: string,
  ) {
    if (!serviceCase.vehicleId) {
      throw new BadRequestException('Service case has no vehicle — cannot create work order');
    }
    return this.ensureWorkOrderTx(this.prisma, tenantId, serviceCase, supplierId, actorUserId);
  }

  private async ensureWorkOrderTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    serviceCase: {
      id: string;
      vehicleId: string | null;
      title: string;
      sourceTicketId: string | null;
      workflowType: ServiceCaseWorkflowType;
    },
    supplierId: string | null,
    actorUserId?: string,
  ) {
    if (!serviceCase.vehicleId) {
      throw new BadRequestException('Service case has no vehicle — cannot create work order');
    }
    const existing = await tx.maintenanceWorkOrder.findFirst({
      where: { serviceCaseId: serviceCase.id },
    });
    if (existing) {
      if (!existing.displayNumber) {
        const displayNumber = await nextWorkOrderDisplayNumber(tx, tenantId, existing.createdAt);
        return tx.maintenanceWorkOrder.update({
          where: { id: existing.id },
          data: { displayNumber },
        });
      }
      return existing;
    }

    const displayNumber = await nextWorkOrderDisplayNumber(tx, tenantId, new Date());
    const serviceOrderType =
      serviceCase.workflowType === ServiceCaseWorkflowType.damage
        ? ServiceOrderType.D
        : ServiceOrderType.M;

    const wo = await tx.maintenanceWorkOrder.create({
      data: {
        tenantId,
        serviceCaseId: serviceCase.id,
        vehicleId: serviceCase.vehicleId,
        supplierId,
        title: serviceCase.title,
        displayNumber,
        serviceOrderType,
        status: supplierId ? MaintenanceWorkOrderStatus.sent : MaintenanceWorkOrderStatus.draft,
      },
    });

    if (serviceCase.sourceTicketId) {
      await tx.crmTicketLink.create({
        data: {
          tenantId,
          ticketId: serviceCase.sourceTicketId,
          entityType: CrmTicketLinkEntityType.work_order,
          entityId: wo.id,
        },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'work_order.create',
      entityType: 'maintenance_work_order',
      entityId: wo.id,
      meta: { serviceCaseId: serviceCase.id, serviceOrderType },
    });

    return wo;
  }

  private caseInclude() {
    return {
      supplier: { select: { legalName: true } },
      workOrders: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          supplier: { select: { legalName: true } },
          quotes: {
            orderBy: { version: 'desc' as const },
            take: 30,
            select: {
              id: true,
              workOrderId: true,
              version: true,
              status: true,
              totalNetCents: true,
              totalVatCents: true,
              currency: true,
              invoicedAt: true,
              invoiceNumber: true,
              invoiceDate: true,
              invoiceAttachmentUrl: true,
              costEntryId: true,
            },
          },
        },
      },
      appointments: {
        orderBy: { scheduledAt: 'asc' as const },
        include: { supplier: { select: { legalName: true } }, serviceCase: { select: { title: true } } },
      },
    };
  }

  private toAppointmentRecord(row: {
    id: string;
    serviceCaseId: string;
    vehicleId: string;
    supplierId: string | null;
    title: string | null;
    scheduledAt: Date;
    durationMin: number;
    location: string | null;
    status: ServiceAppointmentStatus;
    proposedByRole?: ServiceAppointmentProposedBy | null;
    supplierValidatedAt?: Date | null;
    cancellationRequestedAt?: Date | null;
    cancellationRequestNote?: string | null;
    notes: string | null;
    managerConfirmedAt?: Date | null;
    driverAcknowledgedAt?: Date | null;
    driverDeclinedAt?: Date | null;
    driverDeclineNote?: string | null;
    lastProposalNote?: string | null;
    createdAt: Date;
    updatedAt: Date;
    supplier?: { legalName: string } | null;
    serviceCase?: { title: string };
  }): ServiceAppointmentRecord {
    const durationMin = row.durationMin ?? 60;
    const title = row.title?.trim() || row.serviceCase?.title || 'Programare';
    return {
      id: row.id,
      serviceCaseId: row.serviceCaseId,
      vehicleId: row.vehicleId,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier?.legalName ?? null,
      title,
      scheduledAt: row.scheduledAt.toISOString(),
      endAt: new Date(row.scheduledAt.getTime() + durationMin * 60_000).toISOString(),
      durationMin,
      location: row.location,
      status: row.status,
      proposedByRole: row.proposedByRole ?? null,
      supplierValidatedAt: row.supplierValidatedAt?.toISOString() ?? null,
      cancellationRequestedAt: row.cancellationRequestedAt?.toISOString() ?? null,
      cancellationRequestNote: row.cancellationRequestNote ?? null,
      notes: row.notes,
      managerConfirmedAt: row.managerConfirmedAt?.toISOString() ?? null,
      driverAcknowledgedAt: row.driverAcknowledgedAt?.toISOString() ?? null,
      driverDeclinedAt: row.driverDeclinedAt?.toISOString() ?? null,
      driverDeclineNote: row.driverDeclineNote ?? null,
      lastProposalNote: row.lastProposalNote ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private parseDamageConstatareHistory(raw: unknown): DamageConstatareHistoryItem[] {
    if (!Array.isArray(raw)) return [];
    const out: DamageConstatareHistoryItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string') continue;

      if (o.kind === 'reinspection_request') {
        const status =
          o.status === 'pending' || o.status === 'approved' || o.status === 'rejected'
            ? o.status
            : null;
        if (!status || typeof o.sentAt !== 'string') continue;
        const photoIds = Array.isArray(o.photoIds)
          ? o.photoIds.filter((id): id is string => typeof id === 'string')
          : [];
        out.push({
          id: o.id,
          kind: 'reinspection_request',
          sequence: typeof o.sequence === 'number' && o.sequence > 0 ? o.sequence : 1,
          status,
          explanation: typeof o.explanation === 'string' ? o.explanation : '',
          photoIds,
          sentAt: o.sentAt,
          decidedAt: typeof o.decidedAt === 'string' ? o.decidedAt : undefined,
          rejectionReason:
            typeof o.rejectionReason === 'string' ? o.rejectionReason : undefined,
          approvalDocUrl:
            typeof o.approvalDocUrl === 'string' ? o.approvalDocUrl : undefined,
          approvalDocFileName:
            typeof o.approvalDocFileName === 'string' ? o.approvalDocFileName : undefined,
          linkedPvsId: typeof o.linkedPvsId === 'string' ? o.linkedPvsId : undefined,
          mailLogId: typeof o.mailLogId === 'string' ? o.mailLogId : undefined,
        });
        continue;
      }

      if (typeof o.pdfUrl !== 'string' || typeof o.receivedAt !== 'string') {
        continue;
      }
      const mode =
        o.mode === 'photos' || o.mode === 'on_site' ? (o.mode as DamageInspectionMode) : null;
      const kind = o.kind === 'pvs' ? 'pvs' : 'inspection_note';
      out.push({
        id: o.id,
        kind,
        sequence: typeof o.sequence === 'number' && o.sequence > 0 ? o.sequence : undefined,
        requestId: typeof o.requestId === 'string' ? o.requestId : undefined,
        pdfUrl: o.pdfUrl,
        fileName: typeof o.fileName === 'string' ? o.fileName : undefined,
        mode,
        issuedOn: typeof o.issuedOn === 'string' ? o.issuedOn : null,
        receivedAt: o.receivedAt,
        notes: typeof o.notes === 'string' ? o.notes : null,
      });
    }
    return out;
  }

  /** @deprecated use parseDamageConstatareHistory — kept for callers expecting PDF notes only */
  private parseDamageInspectionNotes(raw: unknown): DamageInspectionNoteItem[] {
    return this.parseDamageConstatareHistory(raw).filter(
      (h): h is DamageInspectionNoteItem => h.kind !== 'reinspection_request',
    );
  }

  private parsePaymentAcceptances(raw: unknown): DamagePaymentAcceptanceItem[] {
    if (!Array.isArray(raw)) return [];
    const out: DamagePaymentAcceptanceItem[] = [];
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
    return out.sort((a, b) => b.sequence - a.sequence);
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

  private parseDamagePhotos(raw: unknown): DamagePhotoItem[] {
    if (!Array.isArray(raw)) return [];
    const out: DamagePhotoItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.url !== 'string') continue;
      const kind = typeof o.kind === 'string' && PHOTO_KINDS.has(o.kind) ? o.kind : 'other';
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

  private normalizeDamagePhotos(photos: DamagePhotoItem[]): Prisma.InputJsonValue {
    return photos.map((p) => {
      if (!p.id?.trim() || !p.url?.trim()) {
        throw new BadRequestException('damagePhotos items require id and url');
      }
      const kind = PHOTO_KINDS.has(p.kind) ? p.kind : 'other';
      return {
        id: p.id.trim(),
        url: p.url.trim(),
        kind,
        caption: p.caption?.trim() || undefined,
        uploadedAt: p.uploadedAt || new Date().toISOString(),
        uploadedByUserId: p.uploadedByUserId || undefined,
        uploadedByLabel: p.uploadedByLabel || undefined,
      };
    });
  }

  private async resolveDamageMailOptions(
    tenantId: string,
    mailSettingsRaw: unknown,
    actorUserId?: string | null,
    clientId?: string | null,
  ): Promise<{
    fromName: string | null;
    replyTo: string | null;
    cc: string[];
    signature: string;
  }> {
    const settings = parseTenantMailSettings(mailSettingsRaw);
    const ccSet = new Set(settings.defaultCcEmails.map((e) => e.toLowerCase()));

    if (settings.ccMemberUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: settings.ccMemberUserIds },
          memberships: { some: { tenantId } },
        },
        select: { email: true },
      });
      for (const u of users) {
        const e = u.email?.trim().toLowerCase();
        if (e) ccSet.add(e);
      }
    }

    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, tenantId },
        select: { mailSettings: true },
      });
      if (client) {
        const clientSettings = parseClientMailSettings(client.mailSettings);
        for (const e of clientSettings.ccEmails) {
          ccSet.add(e.toLowerCase());
        }
        if (clientSettings.ccMemberUserIds.length > 0) {
          const users = await this.prisma.user.findMany({
            where: {
              id: { in: clientSettings.ccMemberUserIds },
              clientMemberships: { some: { tenantId, clientId } },
            },
            select: { email: true },
          });
          for (const u of users) {
            const e = u.email?.trim().toLowerCase();
            if (e) ccSet.add(e);
          }
        }
      }
    }

    if (settings.ccActorOnSend && actorUserId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { email: true },
      });
      const e = actor?.email?.trim().toLowerCase();
      if (e) ccSet.add(e);
    }

    return {
      fromName: settings.fromName,
      replyTo: settings.replyTo,
      cc: [...ccSet],
      signature: settings.signature?.trim() || 'Fleet Enterprise',
    };
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
    const out: DamageSectionLocks = {};
    for (const key of DAMAGE_SECTION_KEYS) {
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

  private toRecord(
    row: {
      id: string;
      clientId: string;
      vehicleId: string | null;
      workflowType: ServiceCaseWorkflowType;
      sourceType: ServiceCaseSourceType;
      sourceTicketId: string | null;
      currentStage: ServiceCaseStage;
      status: ServiceCaseStatus;
      supplierId: string | null;
      title: string;
      notes: string | null;
      awaitingPostApproval?: boolean;
      postApprovalPath?: PostApprovalPath | null;
      vehicleMovable?: VehicleMovableState | null;
      damageEventOn?: Date | null;
      damageInsuranceType?: DamageInsuranceType | null;
      damageClaimNumber?: string | null;
      damageInsurerName?: string | null;
      damageInsurerId?: string | null;
      damageClaimStatus?: DamageClaimStatus | null;
      damageInsurerAgreedAt?: Date | null;
      damageInsurerAgreedByUserId?: string | null;
      damageInsurerAgreementNotes?: string | null;
      damagePayerType?: DamagePayerType | null;
      damageInsurerPipelineStatus?: DamageInsurerPipelineStatus | null;
      damageDocumentsJson?: unknown;
      damagePhotosJson?: unknown;
      damageSectionLocksJson?: unknown;
      damageCascoFranchiseCents?: number | null;
      damageInsurerEmail?: string | null;
      damageQuoteOrigin?: DamageQuoteOrigin | null;
      damageInsurerQuotePdfUrl?: string | null;
      damageInsurerMailLogJson?: unknown;
      damageInspectionMode?: DamageInspectionMode | null;
      damageInspectionNotePdfUrl?: string | null;
      damageInspectionNoteFileName?: string | null;
      damageInspectionNoteIssuedOn?: Date | null;
      damageInspectionNoteReceivedAt?: Date | null;
      damageInspectionNoteNotes?: string | null;
      damageInspectionNotesJson?: unknown;
      damagePaymentAcceptancePdfUrl?: string | null;
      damagePaymentAcceptanceFileName?: string | null;
      damagePaymentAcceptanceReceivedAt?: Date | null;
      damagePaymentAcceptanceNotes?: string | null;
      damagePaymentAcceptancesJson?: unknown;
      closedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      supplier?: { legalName: string } | null;
      workOrders?: Array<{
        id: string;
        serviceCaseId: string;
        vehicleId: string;
        supplierId: string | null;
        title: string;
        status: MaintenanceWorkOrderStatus;
        plannedAt: Date | null;
        completedAt: Date | null;
        inServiceAt: Date | null;
        outServiceAt: Date | null;
        displayNumber: string | null;
        odometerKmIn: number | null;
        odometerKmOut: number | null;
        repairPathNote: string | null;
        serviceOrderType: string;
        readyAt: Date | null;
        estimatedRepairAt: Date | null;
        createdAt: Date;
        supplier?: { legalName: string } | null;
        quotes?: Array<{
          id: string;
          workOrderId: string;
          version: number;
          status: WorkOrderQuoteStatus;
          totalNetCents: number;
          totalVatCents: number;
          currency: string;
          invoicedAt: Date | null;
          invoiceNumber: string | null;
          invoiceDate: Date | null;
          invoiceAttachmentUrl: string | null;
          costEntryId: string | null;
        }>;
      }>;
      appointments?: Array<{
        id: string;
        serviceCaseId: string;
        vehicleId: string;
        supplierId: string | null;
        title: string | null;
        scheduledAt: Date;
        durationMin: number;
        location: string | null;
        status: ServiceAppointmentStatus;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        supplier?: { legalName: string } | null;
      }>;
    },
  ): ServiceCaseRecord {
    return {
      id: row.id,
      clientId: row.clientId,
      vehicleId: row.vehicleId,
      workflowType: row.workflowType,
      sourceType: row.sourceType,
      sourceTicketId: row.sourceTicketId,
      currentStage: row.currentStage,
      status: row.status,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier?.legalName ?? null,
      title: row.title,
      notes: row.notes,
      closedAt: row.closedAt?.toISOString() ?? null,
      awaitingPostApproval: row.awaitingPostApproval ?? false,
      postApprovalPath: row.postApprovalPath ?? null,
      vehicleMovable: row.vehicleMovable ?? null,
      damageEventOn: row.damageEventOn
        ? row.damageEventOn.toISOString().slice(0, 10)
        : null,
      damageInsuranceType: row.damageInsuranceType ?? null,
      damageClaimNumber: row.damageClaimNumber ?? null,
      damageInsurerName: row.damageInsurerName ?? null,
      damageInsurerId: row.damageInsurerId ?? null,
      damageClaimStatus: row.damageClaimStatus ?? null,
      damageInsurerAgreedAt: row.damageInsurerAgreedAt?.toISOString() ?? null,
      damageInsurerAgreedByUserId: row.damageInsurerAgreedByUserId ?? null,
      damageInsurerAgreementNotes: row.damageInsurerAgreementNotes ?? null,
      damagePayerType: row.damagePayerType ?? null,
      damageInsurerPipelineStatus: row.damageInsurerPipelineStatus ?? null,
      damageDocuments: this.parseDamageDocuments(row.damageDocumentsJson),
      damagePhotos: this.parseDamagePhotos(row.damagePhotosJson),
      damageSectionLocks: this.parseDamageSectionLocks(row.damageSectionLocksJson),
      damageCascoFranchiseCents: row.damageCascoFranchiseCents ?? null,
      damageInsurerEmail: row.damageInsurerEmail ?? null,
      damageQuoteOrigin: row.damageQuoteOrigin ?? null,
      damageInsurerQuotePdfUrl: row.damageInsurerQuotePdfUrl ?? null,
      damageInsurerMailLog: this.parseDamageInsurerMailLog(row.damageInsurerMailLogJson),
      damageInspectionMode: row.damageInspectionMode ?? null,
      damageInspectionNotePdfUrl: row.damageInspectionNotePdfUrl ?? null,
      damageInspectionNoteFileName: row.damageInspectionNoteFileName ?? null,
      damageInspectionNoteIssuedOn: row.damageInspectionNoteIssuedOn
        ? row.damageInspectionNoteIssuedOn.toISOString().slice(0, 10)
        : null,
      damageInspectionNoteReceivedAt: row.damageInspectionNoteReceivedAt?.toISOString() ?? null,
      damageInspectionNoteNotes: row.damageInspectionNoteNotes ?? null,
      damageInspectionNotes: (() => {
        const hist = this.parseDamageConstatareHistory(row.damageInspectionNotesJson);
        if (hist.length) return hist;
        if (row.damageInspectionNotePdfUrl) {
          return [
            {
              id: 'legacy_inspection_note',
              kind: 'inspection_note' as const,
              pdfUrl: row.damageInspectionNotePdfUrl,
              fileName: row.damageInspectionNoteFileName ?? undefined,
              mode: row.damageInspectionMode ?? null,
              issuedOn: row.damageInspectionNoteIssuedOn
                ? row.damageInspectionNoteIssuedOn.toISOString().slice(0, 10)
                : null,
              receivedAt:
                row.damageInspectionNoteReceivedAt?.toISOString() ??
                row.updatedAt.toISOString(),
              notes: row.damageInspectionNoteNotes ?? null,
            },
          ];
        }
        return [];
      })(),
      damagePaymentAcceptancePdfUrl: row.damagePaymentAcceptancePdfUrl ?? null,
      damagePaymentAcceptanceFileName: row.damagePaymentAcceptanceFileName ?? null,
      damagePaymentAcceptanceReceivedAt:
        row.damagePaymentAcceptanceReceivedAt?.toISOString() ?? null,
      damagePaymentAcceptanceNotes: row.damagePaymentAcceptanceNotes ?? null,
      damagePaymentAcceptances: (() => {
        const parsed = this.parsePaymentAcceptances(row.damagePaymentAcceptancesJson);
        if (parsed.length) return parsed;
        if (row.damagePaymentAcceptancePdfUrl?.trim()) {
          return [
            {
              id: `accept_legacy_${row.id.slice(-8)}`,
              sequence: 1,
              pdfUrl: row.damagePaymentAcceptancePdfUrl.trim(),
              fileName: row.damagePaymentAcceptanceFileName ?? undefined,
              receivedAt:
                row.damagePaymentAcceptanceReceivedAt?.toISOString() ??
                row.createdAt.toISOString(),
              notes: row.damagePaymentAcceptanceNotes ?? null,
            },
          ];
        }
        return [];
      })(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      workOrders: (row.workOrders ?? []).map((wo) => {
        const quotes = wo.quotes ?? [];
        const approved = quotes.find((q) => q.status === WorkOrderQuoteStatus.approved);
        const submitted = quotes.find((q) => q.status === WorkOrderQuoteStatus.submitted);
        const display = approved ?? submitted ?? quotes[0];
        const toSummary = (
          q: (typeof quotes)[number] | null | undefined,
        ): QuoteSummary | null =>
          q
            ? {
                id: q.id,
                workOrderId: q.workOrderId,
                version: q.version,
                status: q.status,
                totalGrossCents: q.totalNetCents + q.totalVatCents,
                currency: q.currency,
                invoicedAt: q.invoicedAt?.toISOString() ?? null,
                invoiceNumber: q.invoiceNumber ?? null,
                invoiceDate: q.invoiceDate?.toISOString() ?? null,
                invoiceAttachmentUrl: q.invoiceAttachmentUrl ?? null,
                costEntryId: q.costEntryId ?? null,
              }
            : null;
        return {
          id: wo.id,
          serviceCaseId: wo.serviceCaseId,
          vehicleId: wo.vehicleId,
          supplierId: wo.supplierId,
          supplierLegalName: wo.supplier?.legalName ?? null,
          title: wo.title,
          status: wo.status,
          plannedAt: wo.plannedAt?.toISOString() ?? null,
          completedAt: wo.completedAt?.toISOString() ?? null,
          inServiceAt: wo.inServiceAt?.toISOString() ?? null,
          outServiceAt: wo.outServiceAt?.toISOString() ?? null,
          displayNumber: wo.displayNumber ?? null,
          odometerKmIn: wo.odometerKmIn ?? null,
          odometerKmOut: wo.odometerKmOut ?? null,
          repairPathNote: wo.repairPathNote ?? null,
          serviceOrderType: wo.serviceOrderType,
          readyAt: wo.readyAt?.toISOString() ?? null,
          estimatedRepairAt: wo.estimatedRepairAt?.toISOString() ?? null,
          createdAt: wo.createdAt.toISOString(),
          latestQuote: toSummary(display),
          approvedQuote: toSummary(approved ?? null),
          pendingQuote: toSummary(submitted ?? null),
          quotes: quotes.map((q) => toSummary(q)!).filter(Boolean),
        };
      }),
      appointments: (row.appointments ?? []).map((a) => this.toAppointmentRecord(a)),
    };
  }
}
