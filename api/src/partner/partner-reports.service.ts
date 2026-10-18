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

@Injectable()
export class PartnerReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
    },
  ): Promise<{ filename: string; csv: string }> {
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
        createdAt: true,
        inServiceAt: true,
        readyAt: true,
        completedAt: true,
        supplier: { select: { code: true, legalName: true } },
        vehicle: { select: { registrationNumber: true } },
        quotes: {
          where: { status: WorkOrderQuoteStatus.approved },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            version: true,
            totalNetCents: true,
            totalVatCents: true,
            approvedNetCents: true,
            approvedVatCents: true,
            invoiceGrossCents: true,
            invoicedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
    });

    const header = [
      'workOrderId',
      'displayNumber',
      'title',
      'status',
      'supplierCode',
      'supplierName',
      'vehicle',
      'createdAt',
      'inServiceAt',
      'readyAt',
      'completedAt',
      'quoteVersion',
      'approvedGrossRon',
      'invoiceGrossRon',
      'invoicedAt',
    ];

    const lines = [header.join(',')];
    for (const r of rows) {
      const q = r.quotes[0];
      const approvedGross =
        q == null
          ? ''
          : q.approvedNetCents != null && q.approvedVatCents != null
            ? (q.approvedNetCents + q.approvedVatCents) / 100
            : (q.totalNetCents + q.totalVatCents) / 100;
      const invoiceGross = q?.invoiceGrossCents != null ? q.invoiceGrossCents / 100 : '';
      lines.push(
        [
          r.id,
          r.displayNumber ?? '',
          r.title,
          r.status,
          r.supplier?.code ?? '',
          r.supplier?.legalName ?? '',
          r.vehicle?.registrationNumber ?? '',
          r.createdAt.toISOString(),
          r.inServiceAt?.toISOString() ?? '',
          r.readyAt?.toISOString() ?? '',
          r.completedAt?.toISOString() ?? '',
          q?.version ?? '',
          approvedGross === '' ? '' : String(approvedGross),
          invoiceGross === '' ? '' : String(invoiceGross),
          q?.invoicedAt?.toISOString() ?? '',
        ]
          .map((c) => escapeCsvCell(String(c)))
          .join(','),
      );
    }

    // Summary footer as comment-like second sheet substitute
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

    const filename = `partner-report-${summary.year}-${String(summary.month).padStart(2, '0')}.csv`;
    return { filename, csv: lines.join('\r\n') + '\r\n' };
  }
}
