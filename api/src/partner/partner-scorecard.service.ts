import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkOrderQuoteStatus } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import {
  isPartnerUser,
  parseSupplierIdsQuery,
  resolvePartnerSupplierIdsFilter,
} from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round2((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return round2(sorted[mid]);
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return round2(sorted[idx]);
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

function pctWithin(values: number[], maxHours: number): number | null {
  if (!values.length) return null;
  const ok = values.filter((v) => v <= maxHours).length;
  return round2((ok / values.length) * 100);
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBuckets(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

type DistStats = {
  count: number;
  median: number | null;
  mean: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
  within24hPercent: number | null;
  within48hPercent: number | null;
};

function distStats(values: number[], withSla = false): DistStats {
  return {
    count: values.length,
    median: median(values),
    mean: avg(values),
    p90: percentile(values, 0.9),
    min: values.length ? round2(Math.min(...values)) : null,
    max: values.length ? round2(Math.max(...values)) : null,
    within24hPercent: withSla ? pctWithin(values, 24) : null,
    within48hPercent: withSla ? pctWithin(values, 48) : null,
  };
}

export type PartnerScorecard = {
  from: string;
  to: string;
  supplierIds: string[];
  definitions: {
    response: string;
    quoteResponse: string;
    turnaround: string;
    priceDeviation: string;
  };
  volume: {
    appointmentsValidated: number;
    appointmentsPendingSupplier: number;
    workOrdersReadyInPeriod: number;
    workOrdersOpen: number;
    quotesSubmittedInPeriod: number;
    quotesInvoicedInPeriod: number;
  };
  responseTimeHours: DistStats;
  quoteResponseTimeHours: DistStats;
  turnaroundHours: DistStats;
  priceDeviationPercent: DistStats & {
    invoiceMismatchCount: number;
    invoiceMismatchPercent: number | null;
    meanAbsPercent: number | null;
    overQuoteCount: number;
    underQuoteCount: number;
    totalInvoicedCents: number;
    totalQuotedCents: number;
  };
  monthly: Array<{
    month: string;
    responseMedianHours: number | null;
    turnaroundMedianHours: number | null;
    priceDeviationMedianPercent: number | null;
    appointmentsValidated: number;
    workOrdersReady: number;
    quotesInvoiced: number;
  }>;
  slowestResponses: Array<{
    appointmentId: string;
    hours: number;
    createdAt: string;
    validatedAt: string;
    vehiclePlate: string | null;
  }>;
  slowestTurnarounds: Array<{
    workOrderId: string;
    displayNumber: string | null;
    title: string;
    hours: number;
    inServiceAt: string;
    readyAt: string;
    vehiclePlate: string | null;
  }>;
  largestPriceDeviations: Array<{
    quoteId: string;
    workOrderId: string;
    displayNumber: string | null;
    deviationPercent: number;
    quotedGrossCents: number;
    invoiceGrossCents: number;
    invoiceMismatch: boolean;
    invoicedAt: string;
    vehiclePlate: string | null;
  }>;
};

@Injectable()
export class PartnerScorecardService {
  constructor(private readonly prisma: PrismaService) {}

  async getScorecard(
    tenantSlug: string,
    access: AccessContext,
    opts: {
      from?: string;
      to?: string;
      supplierId?: string;
      suppliers?: string;
    },
  ): Promise<PartnerScorecard> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const requested = parseSupplierIdsQuery(opts.supplierId, opts.suppliers);
    const supplierIds =
      resolvePartnerSupplierIdsFilter(access, requested) ??
      (isPartnerUser(access) ? [] : requested);

    const now = new Date();
    const to = opts.to?.trim() ? new Date(opts.to) : now;
    const from = opts.from?.trim()
      ? new Date(opts.from)
      : new Date(to.getFullYear(), to.getMonth() - 2, 1);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestException('Invalid from/to');
    }

    const supplierFilter =
      supplierIds && supplierIds.length ? { supplierId: { in: supplierIds } } : {};
    const woSupplier =
      supplierIds && supplierIds.length
        ? { workOrder: { supplierId: { in: supplierIds } } }
        : {};

    const [
      appointments,
      pendingSupplier,
      workOrdersReady,
      workOrdersOpen,
      quotesSubmitted,
      quotesInvoiced,
    ] = await Promise.all([
      this.prisma.serviceAppointment.findMany({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          supplierValidatedAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          createdAt: true,
          supplierValidatedAt: true,
          vehicle: { select: { registrationNumber: true } },
        },
        take: 3000,
      }),
      this.prisma.serviceAppointment.count({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          status: { in: ['pending_supplier', 'needs_repropose'] },
        },
      }),
      this.prisma.maintenanceWorkOrder.findMany({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          inServiceAt: { not: null },
          readyAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          displayNumber: true,
          title: true,
          inServiceAt: true,
          readyAt: true,
          createdAt: true,
          vehicle: { select: { registrationNumber: true } },
          quotes: {
            where: { submittedAt: { not: null } },
            orderBy: { submittedAt: 'asc' },
            take: 1,
            select: { submittedAt: true },
          },
        },
        take: 3000,
      }),
      this.prisma.maintenanceWorkOrder.count({
        where: {
          tenantId: tenant.id,
          ...supplierFilter,
          status: { in: ['draft', 'sent', 'in_progress', 'waiting_parts'] },
        },
      }),
      this.prisma.workOrderQuote.count({
        where: {
          tenantId: tenant.id,
          submittedAt: { gte: from, lte: to },
          ...woSupplier,
        },
      }),
      this.prisma.workOrderQuote.findMany({
        where: {
          tenantId: tenant.id,
          status: WorkOrderQuoteStatus.approved,
          invoicedAt: { gte: from, lte: to },
          ...woSupplier,
        },
        select: {
          id: true,
          workOrderId: true,
          totalNetCents: true,
          totalVatCents: true,
          approvedNetCents: true,
          approvedVatCents: true,
          invoiceGrossCents: true,
          invoiceMismatch: true,
          invoicedAt: true,
          workOrder: {
            select: {
              displayNumber: true,
              vehicle: { select: { registrationNumber: true } },
            },
          },
        },
        take: 3000,
      }),
    ]);

    // Also load WOs created/sent in period for quote-response (may overlap ready set)
    const wosForQuoteResponse = await this.prisma.maintenanceWorkOrder.findMany({
      where: {
        tenantId: tenant.id,
        ...supplierFilter,
        OR: [
          { createdAt: { gte: from, lte: to } },
          { quotes: { some: { submittedAt: { gte: from, lte: to } } } },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        quotes: {
          where: { submittedAt: { not: null } },
          orderBy: { submittedAt: 'asc' },
          take: 1,
          select: { submittedAt: true },
        },
      },
      take: 3000,
    });

    type ApptRow = {
      id: string;
      hours: number;
      createdAt: Date;
      validatedAt: Date;
      plate: string | null;
      month: string;
    };
    const apptRows: ApptRow[] = appointments
      .filter((a) => a.supplierValidatedAt)
      .map((a) => ({
        id: a.id,
        hours: hoursBetween(a.createdAt, a.supplierValidatedAt!),
        createdAt: a.createdAt,
        validatedAt: a.supplierValidatedAt!,
        plate: a.vehicle?.registrationNumber ?? null,
        month: monthKey(a.supplierValidatedAt!),
      }));

    type WoRow = {
      id: string;
      displayNumber: string | null;
      title: string;
      hours: number;
      inServiceAt: Date;
      readyAt: Date;
      plate: string | null;
      month: string;
    };
    const turnRows: WoRow[] = workOrdersReady
      .filter((w) => w.inServiceAt && w.readyAt)
      .map((w) => ({
        id: w.id,
        displayNumber: w.displayNumber,
        title: w.title,
        hours: hoursBetween(w.inServiceAt!, w.readyAt!),
        inServiceAt: w.inServiceAt!,
        readyAt: w.readyAt!,
        plate: w.vehicle?.registrationNumber ?? null,
        month: monthKey(w.readyAt!),
      }));

    const quoteResponseHours: number[] = [];
    for (const w of wosForQuoteResponse) {
      const submitted = w.quotes[0]?.submittedAt;
      if (!submitted) continue;
      if (submitted < from || submitted > to) continue;
      quoteResponseHours.push(hoursBetween(w.createdAt, submitted));
    }

    type PriceRow = {
      quoteId: string;
      workOrderId: string;
      displayNumber: string | null;
      deviationPercent: number;
      quotedGrossCents: number;
      invoiceGrossCents: number;
      invoiceMismatch: boolean;
      invoicedAt: Date;
      plate: string | null;
      month: string;
    };
    const priceRows: PriceRow[] = [];
    let mismatch = 0;
    let over = 0;
    let under = 0;
    let totalInvoiced = 0;
    let totalQuoted = 0;
    for (const q of quotesInvoiced) {
      if (q.invoiceMismatch) mismatch += 1;
      const quoted =
        q.approvedNetCents != null && q.approvedVatCents != null
          ? q.approvedNetCents + q.approvedVatCents
          : q.totalNetCents + q.totalVatCents;
      if (!q.invoiceGrossCents || quoted <= 0 || !q.invoicedAt) continue;
      const pct = ((q.invoiceGrossCents - quoted) / quoted) * 100;
      if (pct > 0.05) over += 1;
      else if (pct < -0.05) under += 1;
      totalInvoiced += q.invoiceGrossCents;
      totalQuoted += quoted;
      priceRows.push({
        quoteId: q.id,
        workOrderId: q.workOrderId,
        displayNumber: q.workOrder.displayNumber,
        deviationPercent: round2(pct),
        quotedGrossCents: quoted,
        invoiceGrossCents: q.invoiceGrossCents,
        invoiceMismatch: q.invoiceMismatch,
        invoicedAt: q.invoicedAt,
        plate: q.workOrder.vehicle?.registrationNumber ?? null,
        month: monthKey(q.invoicedAt),
      });
    }

    const responseHours = apptRows.map((r) => r.hours);
    const turnaroundHours = turnRows.map((r) => r.hours);
    const deviationPercents = priceRows.map((r) => r.deviationPercent);
    const absDevs = deviationPercents.map((d) => Math.abs(d));

    const buckets = monthBuckets(from, to);
    const monthly = buckets.map((month) => {
      const rH = apptRows.filter((r) => r.month === month).map((r) => r.hours);
      const tH = turnRows.filter((r) => r.month === month).map((r) => r.hours);
      const pH = priceRows.filter((r) => r.month === month).map((r) => r.deviationPercent);
      return {
        month,
        responseMedianHours: median(rH),
        turnaroundMedianHours: median(tH),
        priceDeviationMedianPercent: median(pH),
        appointmentsValidated: rH.length,
        workOrdersReady: tH.length,
        quotesInvoiced: pH.length,
      };
    });

    const slowestResponses = [...apptRows]
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
      .map((r) => ({
        appointmentId: r.id,
        hours: round2(r.hours),
        createdAt: r.createdAt.toISOString(),
        validatedAt: r.validatedAt.toISOString(),
        vehiclePlate: r.plate,
      }));

    const slowestTurnarounds = [...turnRows]
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
      .map((r) => ({
        workOrderId: r.id,
        displayNumber: r.displayNumber,
        title: r.title,
        hours: round2(r.hours),
        inServiceAt: r.inServiceAt.toISOString(),
        readyAt: r.readyAt.toISOString(),
        vehiclePlate: r.plate,
      }));

    const largestPriceDeviations = [...priceRows]
      .sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))
      .slice(0, 8)
      .map((r) => ({
        quoteId: r.quoteId,
        workOrderId: r.workOrderId,
        displayNumber: r.displayNumber,
        deviationPercent: r.deviationPercent,
        quotedGrossCents: r.quotedGrossCents,
        invoiceGrossCents: r.invoiceGrossCents,
        invoiceMismatch: r.invoiceMismatch,
        invoicedAt: r.invoicedAt.toISOString(),
        vehiclePlate: r.plate,
      }));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      supplierIds: supplierIds ?? [],
      definitions: {
        response:
          'Ore de la crearea programării până la validarea de către atelier (supplierValidatedAt).',
        quoteResponse:
          'Ore de la crearea WO până la primul deviz trimis (submittedAt) în interval.',
        turnaround: 'Ore de la IN atelier (inServiceAt) până la Gata (readyAt).',
        priceDeviation:
          'Procent (factură − deviz aprobat) / deviz aprobat · 100. Pozitiv = factură peste ofertă.',
      },
      volume: {
        appointmentsValidated: apptRows.length,
        appointmentsPendingSupplier: pendingSupplier,
        workOrdersReadyInPeriod: turnRows.length,
        workOrdersOpen: workOrdersOpen,
        quotesSubmittedInPeriod: quotesSubmitted,
        quotesInvoicedInPeriod: quotesInvoiced.length,
      },
      responseTimeHours: distStats(responseHours, true),
      quoteResponseTimeHours: distStats(quoteResponseHours, true),
      turnaroundHours: distStats(turnaroundHours, false),
      priceDeviationPercent: {
        ...distStats(deviationPercents, false),
        invoiceMismatchCount: mismatch,
        invoiceMismatchPercent:
          quotesInvoiced.length > 0
            ? round2((mismatch / quotesInvoiced.length) * 100)
            : null,
        meanAbsPercent: avg(absDevs),
        overQuoteCount: over,
        underQuoteCount: under,
        totalInvoicedCents: totalInvoiced,
        totalQuotedCents: totalQuoted,
      },
      monthly,
      slowestResponses,
      slowestTurnarounds,
      largestPriceDeviations,
    };
  }
}
