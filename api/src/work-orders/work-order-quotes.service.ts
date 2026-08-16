import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  CrmTicketLinkEntityType,
  MaintenanceWorkOrderStatus,
  Prisma,
  QuotePartsOrderStatus,
  ServiceCaseStage,
  WorkOrderQuoteLineApproval,
  WorkOrderQuoteStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CivOcrService } from '../fleet/civ-ocr.service';
import {
  assertApproveServiceQuote,
  assertClientFleetWrite,
} from '../iam/client-access';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertPartnerSupplierId,
  assertPartnerWrite,
  isPartnerUser,
} from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerNotificationService } from '../partner/partner-notification.service';
import { providerLabelForSupplier } from '../suppliers/supplier-resolve';
import { RemindersService } from '../ops/reminders.service';
import {
  reminderMenuSyncEnabledForCreate,
  shouldRunReminderMenuSync,
} from '../ops/reminder-sync';
import { normalizeReminderOffsets } from '../ops/document-reminders';
import { normalizeReminderOffsetsKm } from '../ops/reminder-status';
import { parseTenantIntegrationsSettings } from '../tenant/integrations-settings';
import { parseWorkOrderSettings, type WorkOrderSettings } from '../tenant/work-order-settings';
import { SERVICE_CASE_STAGE_ORDER } from '../service-cases/service-cases.service';
import { parseWebUploadUrl, readWebUploadFromGcs } from '../storage/web-upload-storage';
import { costCategoryForWorkflow } from './work-order-cost.utils';
import {
  computeApprovedTotals,
  computeQuoteTotals,
  type QuoteLineInput,
  toQuoteRecord,
  type WorkOrderQuoteRecord,
} from './work-order-quotes.types';
import { buildQuotePdfBuffer } from './work-order-quote-pdf';
import {
  parseQuoteTextToPreview,
  type QuoteImportPreview,
  type QuoteImportPreviewLine,
} from './quote-import-parse';

function formatMoney(cents: number): string {
  return `${(cents / 100).toFixed(2)} RON`;
}

export type UpsertQuoteInput = {
  lines: QuoteLineInput[];
  notes?: string | null;
  currency?: string;
};

export type PostCostInput = {
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  syncReminderAction?: boolean;
};

export type ApproveQuoteInput = {
  lineDecisions?: Array<{
    lineId: string;
    status: 'approved' | 'rejected';
  }>;
};

export type PatchQuoteLinePartsInput = {
  partsOrderStatus?: QuotePartsOrderStatus;
  partsExpectedOn?: string | null;
};

export type QuoteImportPreviewInput = {
  text?: string | null;
  fileUrl?: string | null;
};

export type QuoteImportApplyInput = {
  lines: QuoteImportPreviewLine[];
  notes?: string | null;
  currency?: string;
  replaceExistingDraft?: boolean;
};

function reminderOffsetsForDb(
  raw: number[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (raw === undefined) return Prisma.JsonNull;
  if (raw === null) return Prisma.JsonNull;
  const normalized = normalizeReminderOffsets(raw);
  return normalized?.length ? normalized : Prisma.JsonNull;
}

function reminderOffsetsKmForDb(
  raw: number[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (raw === undefined) return Prisma.JsonNull;
  if (raw === null) return Prisma.JsonNull;
  const normalized = normalizeReminderOffsetsKm(raw);
  return normalized?.length ? normalized : Prisma.JsonNull;
}

@Injectable()
export class WorkOrderQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: RemindersService,
    private readonly partnerNotify: PartnerNotificationService,
    private readonly civOcr: CivOcrService,
  ) {}

  private quoteInclude() {
    return {
      lines: { orderBy: { sortOrder: 'asc' as const } },
      costEntry: { select: { invoiceNumber: true, invoiceDate: true } },
    };
  }

  private async assertWoAccess(
    tenantSlug: string,
    workOrderId: string,
    access?: AccessContext,
    mode: 'write' | 'approve' = 'write',
  ) {
    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: workOrderId, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { clientId: true } }, serviceCase: true },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      if (mode === 'approve') {
        if (isPartnerUser(access)) {
          throw new ForbiddenException('Partners cannot approve quotes');
        }
        assertApproveServiceQuote(access, wo.vehicle.clientId);
      } else if (isPartnerUser(access)) {
        assertPartnerSupplierId(access, wo.supplierId);
        assertPartnerWrite(access);
      } else {
        assertClientFleetWrite(access, wo.vehicle.clientId);
      }
    }
    return wo;
  }

  async listByWorkOrder(tenantSlug: string, workOrderId: string): Promise<WorkOrderQuoteRecord[]> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return [];

    const rows = await this.prisma.workOrderQuote.findMany({
      where: { tenantId: tenant.id, workOrderId },
      orderBy: [{ version: 'desc' }],
      include: this.quoteInclude(),
    });
    return rows.map(toQuoteRecord);
  }

  async getById(tenantSlug: string, workOrderId: string, quoteId: string): Promise<WorkOrderQuoteRecord> {
    const row = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenant: { slug: tenantSlug } },
      include: this.quoteInclude(),
    });
    if (!row) throw new NotFoundException('Quote not found');
    return toQuoteRecord(row);
  }

  private async assertQuoteImportEnabled(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { workOrderSettings: true, integrationsSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const wo = parseWorkOrderSettings(tenant.workOrderSettings);
    const integ = parseTenantIntegrationsSettings(tenant.integrationsSettings);
    if (!wo.allowQuotePdfImport || !integ.audatexImportEnabled) {
      throw new BadRequestException(
        'Import PDF dezactivat (Setup → WO / Integrări). Activează allowQuotePdfImport și audatexImportEnabled.',
      );
    }
    return tenant;
  }

  private async loadImportFileBytes(
    rawUrl: string,
  ): Promise<{ buf: Buffer; contentType: string }> {
    const uploadRef = parseWebUploadUrl(rawUrl);
    if (uploadRef) {
      const fromGcs = await readWebUploadFromGcs(uploadRef);
      if (fromGcs) {
        return { buf: fromGcs.data, contentType: fromGcs.contentType };
      }
    }

    const webOrigin = (process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
    let url = rawUrl.trim();
    if (url.startsWith('/') && webOrigin) {
      url = `${webOrigin}${url}`;
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException(
        uploadRef
          ? 'Fișierul nu a fost găsit în storage. Reîncarcă PDF-ul și reîncearcă.'
          : 'fileUrl trebuie să fie absolut sau relative pe WEB_ORIGIN',
      );
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new BadRequestException(`Nu am putut descărca fișierul (HTTP ${res.status})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
    return { buf, contentType };
  }

  async importPreview(
    tenantSlug: string,
    workOrderId: string,
    dto: QuoteImportPreviewInput,
    access?: AccessContext,
  ): Promise<QuoteImportPreview & { ocrError?: string | null }> {
    await this.assertQuoteImportEnabled(tenantSlug);
    await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const pasted = typeof dto.text === 'string' ? dto.text.trim() : '';
    let text = pasted;
    let ocrError: string | null = null;

    const fileUrl = typeof dto.fileUrl === 'string' ? dto.fileUrl.trim() : '';
    if (fileUrl) {
      const { buf, contentType } = await this.loadImportFileBytes(fileUrl);
      const ocr = await this.civOcr.extractText(buf, contentType);
      if (ocr.text?.trim()) {
        text = ocr.text.trim();
      } else {
        ocrError = ocr.error ?? 'OCR fără text';
        if (!text) {
          throw new BadRequestException(
            ocrError
              ? `OCR eșuat: ${ocrError}. Lipește textul din PDF sau reîncearcă cu un scan mai clar.`
              : 'Nu am putut extrage text din fișier. Lipește textul din PDF.',
          );
        }
      }
    }

    if (!text || text.length < 20) {
      throw new BadRequestException(
        'Furnizează un PDF/imagine (fileUrl) sau lipește textul tabelului (min. 20 caractere).',
      );
    }

    const preview = parseQuoteTextToPreview(text);
    if (ocrError) {
      preview.warnings = [
        `OCR parțial / cu eroare (${ocrError}) — am folosit textul lipit.`,
        ...preview.warnings,
      ];
    }
    return { ...preview, ocrError };
  }

  async importApply(
    tenantSlug: string,
    workOrderId: string,
    dto: QuoteImportApplyInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    await this.assertQuoteImportEnabled(tenantSlug);
    await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const rawLines = Array.isArray(dto.lines) ? dto.lines : [];
    if (!rawLines.length) {
      throw new BadRequestException('Selectează cel puțin o linie pentru import');
    }

    const lines: QuoteLineInput[] = rawLines.map((line, idx) => {
      const description = String(line.description ?? '').trim();
      const lineType = line.lineType === 'labor' || line.lineType === 'other' ? line.lineType : 'parts';
      const partNumber =
        typeof line.partNumber === 'string' && line.partNumber.trim()
          ? line.partNumber.trim()
          : null;
      return {
        lineType,
        description,
        quantity: Number(line.quantity) > 0 ? Number(line.quantity) : 1,
        unitNetCents: Math.round(Number(line.unitNetCents) || 0),
        vatRatePercent:
          Number.isFinite(Number(line.vatRatePercent)) && Number(line.vatRatePercent) >= 0
            ? Math.round(Number(line.vatRatePercent))
            : 19,
        partNumber,
        partCodeExempt: lineType === 'parts' && !partNumber,
        sortOrder: idx,
      };
    });

    const notes =
      (dto.notes?.trim() || '') ||
      `Import PDF / Audatex (${new Date().toISOString().slice(0, 10)})`;

    const existingDraft = await this.prisma.workOrderQuote.findFirst({
      where: { workOrderId, status: WorkOrderQuoteStatus.draft },
      select: { id: true },
    });

    if (existingDraft) {
      if (dto.replaceExistingDraft === false) {
        throw new BadRequestException('Există deja o ciornă — editeaz-o sau înlocuiește-o la import');
      }
      return this.updateDraft(
        tenantSlug,
        workOrderId,
        existingDraft.id,
        { lines, notes, currency: dto.currency },
        actorUserId,
        access,
      );
    }

    const created = await this.createDraft(
      tenantSlug,
      workOrderId,
      { lines, notes, currency: dto.currency },
      actorUserId,
      access,
    );

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (tenant) {
      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: 'work_order_quote.import_apply',
        entityType: 'work_order_quote',
        entityId: created.id,
        meta: { workOrderId, lineCount: lines.length },
      });
    }

    return created;
  }

  async createDraft(
    tenantSlug: string,
    workOrderId: string,
    dto: UpsertQuoteInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const wo = await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const existingDraft = await this.prisma.workOrderQuote.findFirst({
      where: { workOrderId, status: WorkOrderQuoteStatus.draft },
    });
    if (existingDraft) {
      throw new BadRequestException('A draft quote already exists — edit or submit it first');
    }

    const settings = parseWorkOrderSettings(tenant.workOrderSettings);
    const lines = this.normalizeLines(dto.lines, settings);
    const { totalNetCents, totalVatCents } = computeQuoteTotals(lines);
    const maxVersion = await this.prisma.workOrderQuote.aggregate({
      where: { workOrderId },
      _max: { version: true },
    });
    const version = (maxVersion._max.version ?? 0) + 1;

    const quote = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workOrderQuote.create({
        data: {
          tenantId: tenant.id,
          workOrderId,
          version,
          currency: dto.currency?.trim() || 'RON',
          totalNetCents,
          totalVatCents,
          notes: dto.notes?.trim() || null,
          lines: {
            create: lines.map((line, idx) => ({
              tenantId: tenant.id,
              sortOrder: line.sortOrder ?? idx,
              lineType: line.lineType ?? 'parts',
              description: line.description,
              quantity: line.quantity ?? 1,
              unitNetCents: line.unitNetCents,
              vatRatePercent: line.vatRatePercent ?? 19,
              partNumber: line.partNumber?.trim() || null,
              partCodeExempt: line.partCodeExempt ?? false,
              warrantyMonths: line.warrantyMonths ?? null,
              warrantyKm: line.warrantyKm ?? null,
            })),
          },
        },
        include: this.quoteInclude(),
      });

      await this.ensureCaseStageAtLeast(
        tx,
        tenant.id,
        wo.serviceCaseId,
        ServiceCaseStage.quote,
        wo.serviceCase.sourceTicketId,
        actorUserId,
      );

      return created;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.create',
      entityType: 'work_order_quote',
      entityId: quote.id,
      meta: { workOrderId, version },
    });

    return toQuoteRecord(quote);
  }

  async updateDraft(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
    dto: UpsertQuoteInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const existing = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Quote not found');
    if (existing.status !== WorkOrderQuoteStatus.draft) {
      throw new BadRequestException('Only draft quotes can be edited');
    }

    const settings = parseWorkOrderSettings(tenant.workOrderSettings);
    const lines = this.normalizeLines(dto.lines, settings);
    const { totalNetCents, totalVatCents } = computeQuoteTotals(lines);

    const quote = await this.prisma.$transaction(async (tx) => {
      await tx.workOrderQuoteLine.deleteMany({ where: { quoteId } });
      return tx.workOrderQuote.update({
        where: { id: quoteId },
        data: {
          currency: dto.currency?.trim() || existing.currency,
          totalNetCents,
          totalVatCents,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
          lines: {
            create: lines.map((line, idx) => ({
              tenantId: tenant.id,
              sortOrder: line.sortOrder ?? idx,
              lineType: line.lineType ?? 'parts',
              description: line.description,
              quantity: line.quantity ?? 1,
              unitNetCents: line.unitNetCents,
              vatRatePercent: line.vatRatePercent ?? 19,
              partNumber: line.partNumber?.trim() || null,
              partCodeExempt: line.partCodeExempt ?? false,
              warrantyMonths: line.warrantyMonths ?? null,
              warrantyKm: line.warrantyKm ?? null,
            })),
          },
        },
        include: this.quoteInclude(),
      });
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.update',
      entityType: 'work_order_quote',
      entityId: quoteId,
      meta: { workOrderId },
    });

    return toQuoteRecord(quote);
  }

  async submit(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const existing = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
      include: { workOrder: { include: { serviceCase: true } }, ...this.quoteInclude() },
    });
    if (!existing) throw new NotFoundException('Quote not found');
    if (existing.status !== WorkOrderQuoteStatus.draft) {
      throw new BadRequestException('Only draft quotes can be submitted');
    }
    if (existing.lines.length === 0) {
      throw new BadRequestException('Quote must have at least one line');
    }
    const settings = parseWorkOrderSettings(tenant.workOrderSettings);
    this.normalizeLines(existing.lines, settings);
    if (!existing.workOrder.estimatedRepairAt) {
      throw new BadRequestException(
        'Estimated repair completion date is required before submitting quote for approval',
      );
    }

    const quote = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workOrderQuote.update({
        where: { id: quoteId },
        data: {
          status: WorkOrderQuoteStatus.submitted,
          submittedAt: new Date(),
        },
        include: this.quoteInclude(),
      });

      await this.ensureCaseStageAtLeast(
        tx,
        tenant.id,
        existing.workOrder.serviceCaseId,
        ServiceCaseStage.approval,
        existing.workOrder.serviceCase.sourceTicketId,
        actorUserId,
      );

      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.submit',
      entityType: 'work_order_quote',
      entityId: quoteId,
      meta: { workOrderId },
    });

    return toQuoteRecord(quote);
  }

  async approve(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
    dto: ApproveQuoteInput = {},
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.assertWoAccess(tenantSlug, workOrderId, access, 'approve');

    const existing = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
      include: { workOrder: { include: { serviceCase: true } }, ...this.quoteInclude() },
    });
    if (!existing) throw new NotFoundException('Quote not found');
    if (existing.status !== WorkOrderQuoteStatus.submitted) {
      throw new BadRequestException('Only submitted quotes can be approved');
    }

    const decisions = new Map<string, WorkOrderQuoteLineApproval>();
    if (dto.lineDecisions?.length) {
      for (const decision of dto.lineDecisions) {
        if (!decision.lineId?.trim()) throw new BadRequestException('lineId is required');
        decisions.set(decision.lineId, decision.status);
      }
      const knownLineIds = new Set(existing.lines.map((line) => line.id));
      for (const lineId of decisions.keys()) {
        if (!knownLineIds.has(lineId)) throw new BadRequestException('Line decision references unknown line');
      }
    }

    const decidedLines = existing.lines.map((line) => ({
      ...line,
      approvalStatus: decisions.size ? decisions.get(line.id) ?? 'rejected' : 'approved',
    }));
    const approvedLines = decidedLines.filter((line) => line.approvalStatus === 'approved');
    if (approvedLines.length === 0) {
      throw new BadRequestException('Trebuie aprobată cel puțin o linie din deviz');
    }
    const approvedTotals = computeApprovedTotals(decidedLines);

    const quote = await this.prisma.$transaction(async (tx) => {
      for (const line of decidedLines) {
        await tx.workOrderQuoteLine.update({
          where: { id: line.id },
          data: { approvalStatus: line.approvalStatus },
        });
      }
      const updated = await tx.workOrderQuote.update({
        where: { id: quoteId },
        data: {
          status: WorkOrderQuoteStatus.approved,
          totalNetCents: approvedTotals.totalNetCents,
          totalVatCents: approvedTotals.totalVatCents,
          approvedNetCents: approvedTotals.totalNetCents,
          approvedVatCents: approvedTotals.totalVatCents,
          approvedAt: new Date(),
          approvedByUserId: actorUserId ?? null,
        },
        include: this.quoteInclude(),
      });

      await tx.serviceCase.update({
        where: { id: existing.workOrder.serviceCaseId },
        data: {
          awaitingPostApproval: true,
          currentStage: ServiceCaseStage.approval,
        },
      });

      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.approve',
      entityType: 'work_order_quote',
      entityId: quoteId,
      meta: { workOrderId },
    });

    void this.partnerNotify.notifySupplierContact(
      tenant.id,
      existing.workOrder.supplierId,
      'quote_approved',
      `Deviz aprobat — ${existing.workOrder.title}`,
      `Devizul v${existing.version} a fost aprobat de client.`,
      { workOrderId, quoteId },
    );

    return toQuoteRecord(quote);
  }

  async patchLineParts(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
    lineId: string,
    dto: PatchQuoteLinePartsInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const existing = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
      include: { workOrder: true, ...this.quoteInclude() },
    });
    if (!existing) throw new NotFoundException('Quote not found');
    const line = existing.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Quote line not found');
    if (line.lineType !== 'parts') {
      throw new BadRequestException('Comanda de piese se poate seta doar pe linii de tip piese');
    }

    const data: Prisma.WorkOrderQuoteLineUpdateInput = {};
    if (dto.partsOrderStatus !== undefined) {
      if (!Object.values(QuotePartsOrderStatus).includes(dto.partsOrderStatus)) {
        throw new BadRequestException('Status comandă piese invalid');
      }
      data.partsOrderStatus = dto.partsOrderStatus;
    }
    if (dto.partsExpectedOn !== undefined) {
      if (dto.partsExpectedOn === null || dto.partsExpectedOn === '') {
        data.partsExpectedOn = null;
      } else {
        const parsed = new Date(dto.partsExpectedOn);
        if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Dată estimată piese invalidă');
        data.partsExpectedOn = parsed;
      }
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No fields to update');

    const quote = await this.prisma.$transaction(async (tx) => {
      await tx.workOrderQuoteLine.update({ where: { id: lineId }, data });

      if (
        dto.partsOrderStatus === QuotePartsOrderStatus.ordered &&
        existing.workOrder.status !== MaintenanceWorkOrderStatus.done &&
        existing.workOrder.status !== MaintenanceWorkOrderStatus.cancelled
      ) {
        await tx.maintenanceWorkOrder.update({
          where: { id: workOrderId },
          data: { status: MaintenanceWorkOrderStatus.waiting_parts },
        });
      }

      return tx.workOrderQuote.findUniqueOrThrow({
        where: { id: quoteId },
        include: this.quoteInclude(),
      });
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.line_parts',
      entityType: 'work_order_quote_line',
      entityId: lineId,
      meta: { workOrderId, quoteId, ...dto },
    });

    return toQuoteRecord(quote);
  }

  async reject(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
    reason: string | null | undefined,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.assertWoAccess(tenantSlug, workOrderId, access, 'approve');

    const existing = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
      include: { workOrder: { include: { serviceCase: true } }, ...this.quoteInclude() },
    });
    if (!existing) throw new NotFoundException('Quote not found');
    if (existing.status !== WorkOrderQuoteStatus.submitted) {
      throw new BadRequestException('Only submitted quotes can be rejected');
    }

    const quote = await this.prisma.workOrderQuote.update({
      where: { id: quoteId },
      data: {
        status: WorkOrderQuoteStatus.rejected,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
      include: this.quoteInclude(),
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.reject',
      entityType: 'work_order_quote',
      entityId: quoteId,
      meta: { workOrderId },
    });

    void this.partnerNotify.notifySupplierContact(
      tenant.id,
      existing.workOrder.supplierId,
      'quote_rejected',
      `Deviz respins — ${existing.workOrder.title}`,
      `Devizul v${existing.version} a fost respins.${reason?.trim() ? ` Motiv: ${reason.trim()}` : ''}`,
      { workOrderId, quoteId },
    );

    return toQuoteRecord(quote);
  }

  async postCost(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
    dto: PostCostInput = {},
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const existing = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
      include: {
        workOrder: { include: { serviceCase: true } },
        ...this.quoteInclude(),
      },
    });
    if (!existing) throw new NotFoundException('Quote not found');
    if (existing.status !== WorkOrderQuoteStatus.approved) {
      throw new BadRequestException('Only approved quotes can be posted to costs');
    }
    if (!existing.invoicedAt) {
      throw new BadRequestException('Record invoice before posting cost');
    }
    if (existing.costEntryId) {
      throw new BadRequestException('Cost already created for this quote');
    }

    const netCents = existing.approvedNetCents ?? existing.totalNetCents;
    const vatCents = existing.approvedVatCents ?? existing.totalVatCents;
    const grossCents = netCents + vatCents;
    const category = costCategoryForWorkflow(existing.workOrder.serviceCase.workflowType);
    const provider = await providerLabelForSupplier(
      this.prisma,
      tenant.id,
      existing.workOrder.supplierId,
      null,
    );
    const notes = [`Deviz v${existing.version} — ${existing.workOrder.title}`, existing.notes?.trim()]
      .filter(Boolean)
      .join('\n');

    const quote = await this.prisma.$transaction(async (tx) => {
      const cost = await tx.costEntry.create({
        data: {
          tenantId: tenant.id,
          vehicleId: existing.workOrder.vehicleId,
          category,
          amountCents: grossCents,
          provider,
          supplierId: existing.workOrder.supplierId,
          incurredOn: existing.invoiceDate ?? new Date(),
          notes,
          odometerKm: existing.workOrder.odometerKmOut ?? existing.workOrder.odometerKmIn ?? null,
          invoiceNumber: existing.invoiceNumber,
          invoiceDate: existing.invoiceDate,
          invoiceAttachmentUrl: existing.invoiceAttachmentUrl,
          nextDueOn:
            dto.nextDueOn === undefined ? null : dto.nextDueOn ? new Date(dto.nextDueOn) : null,
          reminderOffsetsDays: reminderOffsetsForDb(dto.reminderOffsetsDays),
          dueOdometerKm: dto.dueOdometerKm ?? null,
          reminderOffsetsKm: reminderOffsetsKmForDb(dto.reminderOffsetsKm),
          reminderMenuSyncEnabled: reminderMenuSyncEnabledForCreate(dto.syncReminderAction),
        },
      });

      const updated = await tx.workOrderQuote.update({
        where: { id: quoteId },
        data: { costEntryId: cost.id },
        include: this.quoteInclude(),
      });

      const ticketId = existing.workOrder.serviceCase.sourceTicketId;
      if (ticketId) {
        const linkExists = await tx.crmTicketLink.findFirst({
          where: {
            tenantId: tenant.id,
            ticketId,
            entityType: CrmTicketLinkEntityType.cost,
            entityId: cost.id,
          },
        });
        if (!linkExists) {
          await tx.crmTicketLink.create({
            data: {
              tenantId: tenant.id,
              ticketId,
              entityType: CrmTicketLinkEntityType.cost,
              entityId: cost.id,
            },
          });
        }
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId,
            kind: CrmTicketEventKind.transform,
            body: `Cost înregistrat din deviz v${existing.version}: ${formatMoney(grossCents)}.`,
            payload: { entityType: 'cost', entityId: cost.id, quoteId },
            actorUserId: actorUserId ?? null,
          },
        });
      }

      await this.ensureCaseStageAtLeast(
        tx,
        tenant.id,
        existing.workOrder.serviceCaseId,
        ServiceCaseStage.cost,
        ticketId,
        actorUserId,
      );

      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.post_cost',
      entityType: 'work_order_quote',
      entityId: quoteId,
      meta: { workOrderId, costEntryId: quote.costEntryId },
    });

    if (quote.costEntryId) {
      const costRow = await this.prisma.costEntry.findFirst({
        where: { id: quote.costEntryId, tenantId: tenant.id },
      });
      if (
        costRow &&
        shouldRunReminderMenuSync(costRow.reminderMenuSyncEnabled, dto.syncReminderAction)
      ) {
        try {
          const vehicle = await this.prisma.vehicle.findUnique({
            where: { id: costRow.vehicleId },
            select: { registrationNumber: true },
          });
          await this.reminders.syncFromCost(tenant.id, {
            id: costRow.id,
            vehicleId: costRow.vehicleId,
            category: costRow.category,
            title: `${costRow.category} — ${vehicle?.registrationNumber ?? 'vehicul'}`,
            nextDueOn: costRow.nextDueOn,
            reminderOffsetsDays: costRow.reminderOffsetsDays,
            dueOdometerKm: costRow.dueOdometerKm,
            reminderOffsetsKm: costRow.reminderOffsetsKm,
          });
        } catch (err) {
          console.error('syncFromCost after postCost failed', err);
        }
      }
    }

    return toQuoteRecord(quote);
  }

  async recordInvoice(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
    dto: { invoiceNumber: string; invoiceDate: string; invoiceAttachmentUrl?: string | null },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<WorkOrderQuoteRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.assertWoAccess(tenantSlug, workOrderId, access, 'write');

    const invoiceNumber = dto.invoiceNumber?.trim();
    if (!invoiceNumber) throw new BadRequestException('invoiceNumber is required');
    const invoiceDate = new Date(dto.invoiceDate);
    if (Number.isNaN(invoiceDate.getTime())) throw new BadRequestException('Invalid invoiceDate');

    const existing = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
      include: {
        workOrder: { include: { serviceCase: true } },
        ...this.quoteInclude(),
      },
    });
    if (!existing) throw new NotFoundException('Quote not found');
    if (existing.status !== WorkOrderQuoteStatus.approved) {
      throw new BadRequestException('Only approved quotes can be invoiced');
    }
    if (existing.invoicedAt) {
      throw new BadRequestException('Invoice already recorded for this quote');
    }

    const quote = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workOrderQuote.update({
        where: { id: quoteId },
        data: {
          invoiceNumber,
          invoiceDate,
          invoiceAttachmentUrl: dto.invoiceAttachmentUrl?.trim() || null,
          invoicedAt: new Date(),
        },
        include: this.quoteInclude(),
      });

      const ticketId = existing.workOrder.serviceCase.sourceTicketId;
      if (ticketId) {
        await tx.crmTicketEvent.create({
          data: {
            tenantId: tenant.id,
            ticketId,
            kind: CrmTicketEventKind.workflow_advance,
            body: `Factură înregistrată: ${invoiceNumber}.`,
            payload: { quoteId, invoiceNumber },
            actorUserId: actorUserId ?? null,
          },
        });
      }

      await this.ensureCaseStageAtLeast(
        tx,
        tenant.id,
        existing.workOrder.serviceCaseId,
        ServiceCaseStage.invoiced,
        ticketId,
        actorUserId,
      );

      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_order_quote.record_invoice',
      entityType: 'work_order_quote',
      entityId: quoteId,
      meta: { workOrderId, invoiceNumber },
    });

    void this.partnerNotify.notifySupplierContact(
      tenant.id,
      existing.workOrder.supplierId,
      'invoice_recorded',
      `Factură înregistrată — ${existing.workOrder.title}`,
      `Factura ${invoiceNumber} a fost înregistrată pe comanda ${workOrderId}.`,
      { workOrderId, quoteId, invoiceNumber },
    );

    return toQuoteRecord(quote);
  }

  async exportPdf(
    tenantSlug: string,
    workOrderId: string,
    quoteId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = await this.prisma.workOrderQuote.findFirst({
      where: { id: quoteId, workOrderId, tenantId: tenant.id },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        workOrder: { include: { supplier: { select: { legalName: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Quote not found');

    const quote = toQuoteRecord(row);
    const buffer = await buildQuotePdfBuffer({
      workOrderTitle: row.workOrder.title,
      displayNumber: row.workOrder.displayNumber,
      supplierName: row.workOrder.supplier?.legalName ?? null,
      quote,
    });
    return { buffer, filename: `deviz-v${row.version}.pdf` };
  }

  private normalizeLines(lines: QuoteLineInput[], settings: WorkOrderSettings) {
    if (!lines?.length) {
      throw new BadRequestException('At least one quote line is required');
    }
    return lines.map((line, idx) => {
      const description = line.description?.trim();
      if (!description) throw new BadRequestException(`Line ${idx + 1}: description is required`);
      if (!Number.isFinite(line.unitNetCents) || line.unitNetCents < 0) {
        throw new BadRequestException(`Line ${idx + 1}: invalid unit price`);
      }
      const quantity = line.quantity ?? 1;
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`Line ${idx + 1}: invalid quantity`);
      }
      const vatRatePercent = line.vatRatePercent ?? 19;
      if (!Number.isInteger(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
        throw new BadRequestException(`Line ${idx + 1}: invalid VAT rate`);
      }
      const lineType = line.lineType ?? 'parts';
      const partNumber = line.partNumber?.trim() || null;
      const partCodeExempt = line.partCodeExempt ?? false;
      if (settings.requirePartCode && lineType === 'parts' && !partNumber && !partCodeExempt) {
        throw new BadRequestException(`Linia ${idx + 1}: cod piesă obligatoriu sau marcați explicit fără cod`);
      }
      const warrantyMonths = line.warrantyMonths ?? null;
      if (warrantyMonths != null && (!Number.isFinite(warrantyMonths) || warrantyMonths < 0)) {
        throw new BadRequestException(`Line ${idx + 1}: invalid warranty months`);
      }
      const warrantyKm = line.warrantyKm ?? null;
      if (warrantyKm != null && (!Number.isFinite(warrantyKm) || warrantyKm < 0)) {
        throw new BadRequestException(`Line ${idx + 1}: invalid warranty km`);
      }
      return {
        ...line,
        lineType,
        description,
        quantity,
        unitNetCents: Math.round(line.unitNetCents),
        vatRatePercent,
        partNumber,
        partCodeExempt,
        warrantyMonths: warrantyMonths == null ? null : Math.round(warrantyMonths),
        warrantyKm: warrantyKm == null ? null : Math.round(warrantyKm),
      };
    });
  }

  private async ensureCaseStageAtLeast(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceCaseId: string,
    targetStage: ServiceCaseStage,
    sourceTicketId: string | null,
    actorUserId?: string,
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
          body: `Dosar avansat automat la etapa ${targetStage} (deviz).`,
          payload: { fromStage: serviceCase.currentStage, toStage: targetStage, serviceCaseId },
          actorUserId: actorUserId ?? null,
        },
      });
    }
  }
}
