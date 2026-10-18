import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkOrderQuoteStatus } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import {
  isPartnerUser,
  parseSupplierIdsQuery,
  resolvePartnerSupplierIdsFilter,
} from '../iam/partner-access';
import { escapeCsvCell, MAX_EXPORT_ROWS } from '../ops/ops-csv';
import { PrismaService } from '../prisma/prisma.service';
import {
  parsePartnerReportFields,
  partnerReportFieldsCatalog,
  PARTNER_REPORT_FIELDS,
} from './partner-report-fields';

export type PartnerMonthlyReportMeta = {
  year: number;
  month: number;
  from: string;
  to: string;
  supplierIds: string[];
  workOrderCount: number;
  completedCount: number;
  readyCount: number;
  appointmentCompletedCount: number;
  quoteApprovedCount: number;
  quoteInvoicedCount: number;
  valueInvoicedCents: number;
  valueApprovedCents: number;
};

function centsToRon(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '';
  return String(Math.round(cents) / 100);
}

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString() : '';
}

@Injectable()
export class PartnerReportsService {
  constructor(private readonly prisma: PrismaService) {}

  fieldsCatalog() {
    return partnerReportFieldsCatalog();
  }

  private periodBounds(year: number, month: number): { from: Date; to: Date } {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year invalid');
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be 1–12');
    }
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    return { from, to };
  }

  async monthlySummary(
    tenantSlug: string,
    access: AccessContext,
    opts: {
      year?: number;
      month?: number;
      supplierId?: string;
      suppliers?: string;
    },
  ): Promise<PartnerMonthlyReportMeta> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const now = new Date();
    const year = opts.year ?? now.getUTCFullYear();
    const month = opts.month ?? now.getUTCMonth() + 1;
    const { from, to } = this.periodBounds(year, month);

    const requested = parseSupplierIdsQuery(opts.supplierId, opts.suppliers);
    const supplierIds =
      resolvePartnerSupplierIdsFilter(access, requested) ??
      (isPartnerUser(access) ? [] : requested);
    const supplierFilter =
      supplierIds && supplierIds.length ? { supplierId: { in: supplierIds } } : {};

    const [
      workOrderCount,
      completedCount,
      readyCount,
      appointmentCompletedCount,
      quotes,
    ] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          createdAt: { gte: from, lt: to },
        },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          completedAt: { gte: from, lt: to },
        },
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          readyAt: { gte: from, lt: to },
        },
      }),
      this.prisma.serviceAppointment.count({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          status: 'completed',
          scheduledAt: { gte: from, lt: to },
        },
      }),
      this.prisma.workOrderQuote.findMany({
        where: {
          tenantId: tenant.id,
          status: WorkOrderQuoteStatus.approved,
          OR: [
            { invoicedAt: { gte: from, lt: to } },
            { approvedAt: { gte: from, lt: to } },
          ],
          workOrder: supplierIds?.length ? { supplierId: { in: supplierIds } } : {},
        },
        select: {
          invoicedAt: true,
          approvedAt: true,
          invoiceGrossCents: true,
          approvedNetCents: true,
          approvedVatCents: true,
          totalNetCents: true,
          totalVatCents: true,
        },
        take: MAX_EXPORT_ROWS,
      }),
    ]);

    let quoteApprovedCount = 0;
    let quoteInvoicedCount = 0;
    let valueInvoicedCents = 0;
    let valueApprovedCents = 0;
    for (const q of quotes) {
      const approvedGross =
        q.approvedNetCents != null && q.approvedVatCents != null
          ? q.approvedNetCents + q.approvedVatCents
          : q.totalNetCents + q.totalVatCents;
      if (q.approvedAt && q.approvedAt >= from && q.approvedAt < to) {
        quoteApprovedCount += 1;
        valueApprovedCents += approvedGross;
      }
      if (q.invoicedAt && q.invoicedAt >= from && q.invoicedAt < to) {
        quoteInvoicedCount += 1;
        valueInvoicedCents += q.invoiceGrossCents ?? approvedGross;
      }
    }

    return {
      year,
      month,
      from: from.toISOString(),
      to: to.toISOString(),
      supplierIds: supplierIds ?? [],
      workOrderCount,
      completedCount,
      readyCount,
      appointmentCompletedCount,
      quoteApprovedCount,
      quoteInvoicedCount,
      valueInvoicedCents,
      valueApprovedCents,
    };
  }

  async monthlyCsv(
    tenantSlug: string,
    access: AccessContext,
    opts: {
      year?: number;
      month?: number;
      supplierId?: string;
      suppliers?: string;
      fields?: string;
    },
  ): Promise<{ filename: string; csv: string }> {
    const fieldIds = parsePartnerReportFields(opts.fields);
    const includeSummary = fieldIds.includes('summaryFooter');
    const rowFieldIds = fieldIds.filter((id) => id !== 'summaryFooter');

    const summary = await this.monthlySummary(tenantSlug, access, opts);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const { from, to } = this.periodBounds(summary.year, summary.month);
    const supplierIds = summary.supplierIds;
    const supplierFilter =
      supplierIds.length > 0 ? { supplierId: { in: supplierIds } } : {};

    const rows = await this.prisma.maintenanceWorkOrder.findMany({
      where: {
        tenantId: tenant.id,
        ...supplierFilter,
        OR: [
          { createdAt: { gte: from, lt: to } },
          { readyAt: { gte: from, lt: to } },
          { completedAt: { gte: from, lt: to } },
        ],
      },
      select: {
        id: true,
        displayNumber: true,
        title: true,
        status: true,
        serviceOrderType: true,
        workshopStatusCode: true,
        notes: true,
        repairPathNote: true,
        createdAt: true,
        plannedAt: true,
        inServiceAt: true,
        outServiceAt: true,
        readyAt: true,
        completedAt: true,
        estimatedRepairAt: true,
        supplementRepairAt: true,
        odometerKmIn: true,
        odometerKmOut: true,
        supplier: { select: { code: true, legalName: true } },
        vehicle: {
          select: {
            registrationNumber: true,
            brand: true,
            model: true,
            vin: true,
          },
        },
        serviceCase: {
          select: {
            id: true,
            status: true,
            currentStage: true,
            appointments: {
              orderBy: { scheduledAt: 'desc' },
              take: 1,
              select: { scheduledAt: true, status: true },
            },
          },
        },
        _count: { select: { photos: true } },
        quotes: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            version: true,
            status: true,
            title: true,
            currency: true,
            totalNetCents: true,
            totalVatCents: true,
            approvedNetCents: true,
            approvedVatCents: true,
            invoiceGrossCents: true,
            invoiceMismatch: true,
            submittedAt: true,
            approvedAt: true,
            invoicedAt: true,
            _count: { select: { lines: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
    });

    const labelById = new Map(PARTNER_REPORT_FIELDS.map((f) => [f.id, f.label]));
    const header = rowFieldIds.map((id) => labelById.get(id) ?? id);
    const lines = [header.map((h) => escapeCsvCell(h)).join(',')];

    for (const r of rows) {
      const q = r.quotes[0];
      const approvedNet =
        q?.approvedNetCents != null ? q.approvedNetCents : (q?.totalNetCents ?? null);
      const approvedVat =
        q?.approvedVatCents != null ? q.approvedVatCents : (q?.totalVatCents ?? null);
      const approvedGross =
        approvedNet != null && approvedVat != null ? approvedNet + approvedVat : null;
      const appt = r.serviceCase.appointments[0];

      const cell: Record<string, string> = {
        workOrderId: r.id,
        displayNumber: r.displayNumber ?? '',
        title: r.title,
        status: r.status,
        serviceOrderType: r.serviceOrderType,
        workshopStatusCode: r.workshopStatusCode ?? '',
        notes: r.notes ?? '',
        repairPathNote: r.repairPathNote ?? '',
        supplierCode: r.supplier?.code ?? '',
        supplierName: r.supplier?.legalName ?? '',
        photoCount: String(r._count.photos),
        vehiclePlate: r.vehicle?.registrationNumber ?? '',
        vehicleBrand: r.vehicle?.brand ?? '',
        vehicleModel: r.vehicle?.model ?? '',
        vehicleVin: r.vehicle?.vin ?? '',
        odometerKmIn: r.odometerKmIn != null ? String(r.odometerKmIn) : '',
        odometerKmOut: r.odometerKmOut != null ? String(r.odometerKmOut) : '',
        createdAt: iso(r.createdAt),
        plannedAt: iso(r.plannedAt),
        inServiceAt: iso(r.inServiceAt),
        outServiceAt: iso(r.outServiceAt),
        readyAt: iso(r.readyAt),
        completedAt: iso(r.completedAt),
        estimatedRepairAt: iso(r.estimatedRepairAt),
        supplementRepairAt: iso(r.supplementRepairAt),
        quoteVersion: q?.version != null ? String(q.version) : '',
        quoteStatus: q?.status ?? '',
        quoteTitle: q?.title ?? '',
        currency: q?.currency ?? '',
        approvedNetRon: centsToRon(approvedNet),
        approvedVatRon: centsToRon(approvedVat),
        approvedGrossRon: centsToRon(approvedGross),
        invoiceGrossRon: centsToRon(q?.invoiceGrossCents),
        invoiceMismatch: q ? (q.invoiceMismatch ? 'yes' : 'no') : '',
        submittedAt: iso(q?.submittedAt),
        approvedAt: iso(q?.approvedAt),
        invoicedAt: iso(q?.invoicedAt),
        quoteLineCount: q?._count.lines != null ? String(q._count.lines) : '',
        serviceCaseId: r.serviceCase.id,
        serviceCaseStage: r.serviceCase.currentStage ?? '',
        serviceCaseStatus: r.serviceCase.status ?? '',
        appointmentScheduledAt: iso(appt?.scheduledAt),
        appointmentStatus: appt?.status ?? '',
      };

      lines.push(
        rowFieldIds
          .map((id) => escapeCsvCell(cell[id] ?? ''))
          .join(','),
      );
    }

    if (includeSummary) {
      lines.push('');
      lines.push(
        [
          'SUMMARY',
          `year=${summary.year}`,
          `month=${summary.month}`,
          `woCreated=${summary.workOrderCount}`,
          `ready=${summary.readyCount}`,
          `completed=${summary.completedCount}`,
          `apptCompleted=${summary.appointmentCompletedCount}`,
          `quotesApproved=${summary.quoteApprovedCount}`,
          `quotesInvoiced=${summary.quoteInvoicedCount}`,
          `valueApprovedRon=${(summary.valueApprovedCents / 100).toFixed(2)}`,
          `valueInvoicedRon=${(summary.valueInvoicedCents / 100).toFixed(2)}`,
        ]
          .map((c) => escapeCsvCell(c))
          .join(','),
      );
    }

    const filename = `partner-report-${summary.year}-${String(summary.month).padStart(2, '0')}.csv`;
    return { filename, csv: lines.join('\r\n') + '\r\n' };
  }
}
