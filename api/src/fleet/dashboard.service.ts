import { Injectable } from '@nestjs/common';
import { VehicleStatus } from '@prisma/client';
import { DOCUMENT_EXPIRING_WITHIN_DAYS } from '../ops/document-types';
import { normalizeReminderOffsets } from '../ops/document-reminders';
import {
  computeReminderActionSummary,
  matchesActionReminderFilter,
  normalizeReminderOffsetsKm,
} from '../ops/reminder-status';
import { PrismaService } from '../prisma/prisma.service';
import type {
  FleetDashboardItpRow,
  FleetDashboardReminderRow,
  FleetDashboardSnapshot,
} from './dashboard.types';

const ITP_LIST_LIMIT = 8;
const REMINDER_LIST_LIMIT = 8;
const REMINDER_SCAN_LIMIT = 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function formatUtcDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentMonthRangeUtc(): { from: string; to: string; start: Date; end: Date } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { from: formatUtcDay(start), to: formatUtcDay(end), start, end };
}

function emptySnapshot(): FleetDashboardSnapshot {
  const month = currentMonthRangeUtc();
  const links = buildKpiLinks(month.from, month.to);
  return {
    generatedAt: new Date().toISOString(),
    currentMonth: { from: month.from, to: month.to },
    kpis: {
      vehiclesActive: 0,
      vehiclesTotal: 0,
      itpWithin30Days: 0,
      itpWithin60Days: 0,
      documentsExpired: 0,
      documentsExpiringSoon: 0,
      remindersNeedingAction: 0,
      remindersOverdue: 0,
      remindersActive: 0,
      costsCurrentMonthCents: 0,
      tripsCurrentMonth: 0,
    },
    links,
    itpSoon: [],
    remindersDue: [],
  };
}

function buildKpiLinks(monthFrom: string, monthTo: string) {
  return {
    vehiclesActive: '/fleet/vehicles?status=active',
    itpWithin30Days: '/fleet/vehicles?status=active',
    itpWithin60Days: '/fleet/vehicles?status=active',
    documentsExpired: '/fleet/documents?expiryStatus=expired',
    documentsExpiringSoon: '/fleet/documents?expiryStatus=expiring',
    remindersNeedingAction: '/fleet/reminders?status=action',
    remindersOverdue: '/fleet/reminders?status=expired',
    costsCurrentMonth: `/fleet/costs?incurredFrom=${monthFrom}&incurredTo=${monthTo}`,
    tripsCurrentMonth: `/fleet/trips?startedFrom=${monthFrom}&startedTo=${monthTo}`,
  };
}

const reminderInclude = {
  vehicle: {
    select: {
      registrationNumber: true,
      client: { select: { code: true } },
      odometerKm: true,
    },
  },
} as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(tenantSlug: string): Promise<FleetDashboardSnapshot> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return emptySnapshot();

    const today = startOfUtcDay(new Date());
    const in30 = addUtcDays(today, 30);
    const in60 = addUtcDays(today, 60);
    const expiringUntil = addUtcDays(today, DOCUMENT_EXPIRING_WITHIN_DAYS);
    const month = currentMonthRangeUtc();
    const vehicleBase = { tenantId: tenant.id };
    const activeItpWindow = {
      status: VehicleStatus.active,
      itpExpiresOn: { not: null },
    };

    const [
      vehiclesActive,
      vehiclesTotal,
      itpWithin30Days,
      itpWithin60Days,
      documentsExpired,
      documentsExpiringSoon,
      costsAgg,
      tripsCurrentMonth,
      itpSoonRows,
      reminderRows,
      remindersActive,
    ] = await Promise.all([
      this.prisma.vehicle.count({
        where: { ...vehicleBase, status: VehicleStatus.active },
      }),
      this.prisma.vehicle.count({ where: vehicleBase }),
      this.prisma.vehicle.count({
        where: {
          ...vehicleBase,
          ...activeItpWindow,
          itpExpiresOn: { gte: today, lte: in30 },
        },
      }),
      this.prisma.vehicle.count({
        where: {
          ...vehicleBase,
          ...activeItpWindow,
          itpExpiresOn: { gte: today, lte: in60 },
        },
      }),
      this.prisma.vehicleDocument.count({
        where: {
          vehicle: vehicleBase,
          expiresOn: { lt: today },
        },
      }),
      this.prisma.vehicleDocument.count({
        where: {
          vehicle: vehicleBase,
          expiresOn: { gte: today, lte: expiringUntil },
        },
      }),
      this.prisma.costEntry.aggregate({
        where: {
          tenantId: tenant.id,
          incurredOn: { gte: month.start, lte: month.end },
        },
        _sum: { amountCents: true },
      }),
      this.prisma.trip.count({
        where: {
          tenantId: tenant.id,
          startedAt: { gte: month.start, lte: month.end },
        },
      }),
      this.prisma.vehicle.findMany({
        where: {
          ...vehicleBase,
          ...activeItpWindow,
          itpExpiresOn: { gte: today, lte: in60 },
        },
        select: {
          id: true,
          registrationNumber: true,
          itpExpiresOn: true,
          client: { select: { code: true } },
        },
        orderBy: { itpExpiresOn: 'asc' },
        take: ITP_LIST_LIMIT,
      }),
      this.prisma.reminderAction.findMany({
        where: { tenantId: tenant.id, isActive: true },
        include: reminderInclude,
        orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
        take: REMINDER_SCAN_LIMIT,
      }),
      this.prisma.reminderAction.count({
        where: { tenantId: tenant.id, isActive: true },
      }),
    ]);

    let remindersNeedingAction = 0;
    let remindersOverdue = 0;
    const remindersDue: FleetDashboardReminderRow[] = [];

    for (const row of reminderRows) {
      const reminderOffsetsDays = normalizeReminderOffsets(row.reminderOffsetsDays);
      const reminderOffsetsKm = normalizeReminderOffsetsKm(row.reminderOffsetsKm);
      const summary = computeReminderActionSummary(
        {
          isActive: row.isActive,
          dueOn: row.dueOn,
          reminderOffsetsDays,
          dueOdometerKm: row.dueOdometerKm,
          reminderOffsetsKm,
        },
        row.vehicle.odometerKm,
      );

      if (matchesActionReminderFilter(summary, 'action')) {
        remindersNeedingAction += 1;
        remindersDue.push({
          id: row.id,
          title: row.title,
          vehicleId: row.vehicleId,
          registrationNumber: row.vehicle.registrationNumber,
          clientId: row.vehicle.client.code,
          status: summary.status,
          dueOn: row.dueOn ? row.dueOn.toISOString() : null,
        });
      }
      if (matchesActionReminderFilter(summary, 'expired')) {
        remindersOverdue += 1;
      }
    }

    remindersDue.sort((a, b) => {
      const da = a.dueOn ? new Date(a.dueOn).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueOn ? new Date(b.dueOn).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });

    const itpSoon: FleetDashboardItpRow[] = itpSoonRows
      .filter((v) => v.itpExpiresOn != null)
      .map((v) => {
        const expiry = startOfUtcDay(v.itpExpiresOn!);
        const daysUntilExpiry = Math.round(
          (expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
        );
        return {
          vehicleId: v.id,
          registrationNumber: v.registrationNumber,
          clientId: v.client.code,
          itpExpiresOn: v.itpExpiresOn!.toISOString(),
          daysUntilExpiry,
        };
      });

    return {
      generatedAt: new Date().toISOString(),
      currentMonth: { from: month.from, to: month.to },
      kpis: {
        vehiclesActive,
        vehiclesTotal,
        itpWithin30Days,
        itpWithin60Days,
        documentsExpired,
        documentsExpiringSoon,
        remindersNeedingAction,
        remindersOverdue,
        remindersActive,
        costsCurrentMonthCents: costsAgg._sum.amountCents ?? 0,
        tripsCurrentMonth,
      },
      links: buildKpiLinks(month.from, month.to),
      itpSoon,
      remindersDue: remindersDue.slice(0, REMINDER_LIST_LIMIT),
    };
  }
}
