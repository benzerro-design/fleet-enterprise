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

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
  }
  return Math.round(sorted[mid] * 100) / 100;
}

function pctWithin(values: number[], maxHours: number): number | null {
  if (!values.length) return null;
  const ok = values.filter((v) => v <= maxHours).length;
  return Math.round((ok / values.length) * 1000) / 10;
}

export type PartnerScorecard = {
  from: string;
  to: string;
  supplierIds: string[];
  sample: {
    appointmentsValidated: number;
    workOrdersWithTurnaround: number;
    quotesInvoiced: number;
  };
  responseTimeHours: {
    median: number | null;
    p90: number | null;
    within24hPercent: number | null;
    within48hPercent: number | null;
  };
  turnaroundHours: {
    median: number | null;
    p90: number | null;
  };
  priceDeviationPercent: {
    medianVsQuote: number | null;
    invoiceMismatchCount: number;
  };
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
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid from/to');
    }

    const supplierFilter =
      supplierIds && supplierIds.length ? { supplierId: { in: supplierIds } } : {};

    const appointments = await this.prisma.serviceAppointment.findMany({
      where: {
        tenantId: tenant.id,
        ...supplierFilter,
        supplierValidatedAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        supplierValidatedAt: true,
      },
      take: 2000,
    });

    const responseHours = appointments
      .filter((a) => a.supplierValidatedAt)
      .map((a) => hoursBetween(a.createdAt, a.supplierValidatedAt!));

    const workOrders = await this.prisma.maintenanceWorkOrder.findMany({
      where: {
        tenantId: tenant.id,
        ...supplierFilter,
        inServiceAt: { not: null },
        readyAt: { gte: from, lte: to },
      },
      select: { inServiceAt: true, readyAt: true },
      take: 2000,
    });

    const turnaroundHours = workOrders
      .filter((w) => w.inServiceAt && w.readyAt)
      .map((w) => hoursBetween(w.inServiceAt!, w.readyAt!));

    const quotes = await this.prisma.workOrderQuote.findMany({
      where: {
        tenantId: tenant.id,
        status: WorkOrderQuoteStatus.approved,
        invoicedAt: { gte: from, lte: to },
        workOrder: supplierIds?.length ? { supplierId: { in: supplierIds } } : {},
      },
      select: {
        totalNetCents: true,
        totalVatCents: true,
        approvedNetCents: true,
        approvedVatCents: true,
        invoiceGrossCents: true,
        invoiceMismatch: true,
      },
      take: 2000,
    });

    const deviations: number[] = [];
    let mismatch = 0;
    for (const q of quotes) {
      if (q.invoiceMismatch) mismatch += 1;
      const quoted =
        q.approvedNetCents != null && q.approvedVatCents != null
          ? q.approvedNetCents + q.approvedVatCents
          : q.totalNetCents + q.totalVatCents;
      if (!q.invoiceGrossCents || quoted <= 0) continue;
      deviations.push(((q.invoiceGrossCents - quoted) / quoted) * 100);
    }

    const sortedResponse = [...responseHours].sort((a, b) => a - b);
    const p90Response =
      sortedResponse.length > 0
        ? sortedResponse[Math.min(sortedResponse.length - 1, Math.floor(sortedResponse.length * 0.9))]
        : null;
    const sortedTurn = [...turnaroundHours].sort((a, b) => a - b);
    const p90Turn =
      sortedTurn.length > 0
        ? sortedTurn[Math.min(sortedTurn.length - 1, Math.floor(sortedTurn.length * 0.9))]
        : null;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      supplierIds: supplierIds ?? [],
      sample: {
        appointmentsValidated: responseHours.length,
        workOrdersWithTurnaround: turnaroundHours.length,
        quotesInvoiced: quotes.length,
      },
      responseTimeHours: {
        median: median(responseHours),
        p90: p90Response != null ? Math.round(p90Response * 100) / 100 : null,
        within24hPercent: pctWithin(responseHours, 24),
        within48hPercent: pctWithin(responseHours, 48),
      },
      turnaroundHours: {
        median: median(turnaroundHours),
        p90: p90Turn != null ? Math.round(p90Turn * 100) / 100 : null,
      },
      priceDeviationPercent: {
        medianVsQuote: median(deviations.map((d) => Math.round(d * 100) / 100)),
        invoiceMismatchCount: mismatch,
      },
    };
  }
}
