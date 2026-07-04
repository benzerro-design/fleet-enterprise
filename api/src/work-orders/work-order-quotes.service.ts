import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmTicketEventKind,
  CrmTicketLinkEntityType,
  Prisma,
  ServiceCaseStage,
  WorkOrderQuoteStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  assertApproveServiceQuote,
  assertClientFleetWrite,
} from '../iam/client-access';
import type { AccessContext } from '../iam/access-context.types';
import { PrismaService } from '../prisma/prisma.service';
import { providerLabelForSupplier } from '../suppliers/supplier-resolve';
import { SERVICE_CASE_STAGE_ORDER } from '../service-cases/service-cases.service';
import { costCategoryForWorkflow } from './work-order-cost.utils';
import {
  computeQuoteTotals,
  type QuoteLineInput,
  toQuoteRecord,
  type WorkOrderQuoteRecord,
} from './work-order-quotes.types';

function formatMoney(cents: number): string {
  return `${(cents / 100).toFixed(2)} RON`;
}

export type UpsertQuoteInput = {
  lines: QuoteLineInput[];
  notes?: string | null;
  currency?: string;
};

@Injectable()
export class WorkOrderQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
      if (mode === 'approve') assertApproveServiceQuote(access, wo.vehicle.clientId);
      else assertClientFleetWrite(access, wo.vehicle.clientId);
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

    const lines = this.normalizeLines(dto.lines);
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

    const lines = this.normalizeLines(dto.lines);
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

    const quote = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workOrderQuote.update({
        where: { id: quoteId },
        data: {
          status: WorkOrderQuoteStatus.approved,
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
      include: this.quoteInclude(),
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

    return toQuoteRecord(quote);
  }

  async postCost(
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

    const grossCents = existing.totalNetCents + existing.totalVatCents;
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
          invoiceNumber: existing.invoiceNumber,
          invoiceDate: existing.invoiceDate,
          invoiceAttachmentUrl: existing.invoiceAttachmentUrl,
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

    return toQuoteRecord(quote);
  }

  private normalizeLines(lines: QuoteLineInput[]) {
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
      return { ...line, description, quantity, unitNetCents: Math.round(line.unitNetCents), vatRatePercent };
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
