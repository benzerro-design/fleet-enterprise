import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  MaintenanceWorkOrderStatus,
  MembershipRole,
  ServiceAppointmentStatus,
  ServiceCaseStatus,
  SupplierStatus,
  WorkOrderQuoteStatus,
} from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { PrismaService } from '../prisma/prisma.service';

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export type PartnerSupplierOverviewRow = {
  id: string;
  code: string;
  legalName: string;
  status: SupplierStatus;
  open: number;
  pendingApproval: number;
  readyUninvoiced: number;
  appointmentsThisWeek: number;
};

export type PartnerAdminOverview = {
  totals: {
    open: number;
    pendingApproval: number;
    readyUninvoiced: number;
    appointmentsThisWeek: number;
    supplierCount: number;
  };
  suppliers: PartnerSupplierOverviewRow[];
};

@Injectable()
export class PartnerAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdminAccess(access: AccessContext): void {
    if (
      access.membershipRole !== MembershipRole.tenant_admin &&
      access.membershipRole !== MembershipRole.tenant_viewer
    ) {
      throw new ForbiddenException('Admin access required');
    }
  }

  async getOverview(
    tenantSlug: string,
    access: AccessContext,
    filterSupplierIds?: string[],
  ): Promise<PartnerAdminOverview> {
    this.assertAdminAccess(access);

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    const emptyTotals = {
      open: 0,
      pendingApproval: 0,
      readyUninvoiced: 0,
      appointmentsThisWeek: 0,
      supplierCount: 0,
    };
    if (!tenant) return { totals: emptyTotals, suppliers: [] };

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        tenantId: tenant.id,
        status: SupplierStatus.active,
        ...(filterSupplierIds?.length ? { id: { in: filterSupplierIds } } : {}),
      },
      orderBy: { legalName: 'asc' },
      select: { id: true, code: true, legalName: true, status: true },
    });

    const now = new Date();
    const weekStart = startOfWeekMonday(now);
    const weekEnd = addDays(weekStart, 7);

    const rows: PartnerSupplierOverviewRow[] = await Promise.all(
      suppliers.map(async (s) => {
        const woBase = { tenantId: tenant.id, supplierId: s.id };
        const [open, pendingApproval, readyUninvoiced, appointmentsThisWeek] = await Promise.all([
          this.prisma.maintenanceWorkOrder.count({
            where: {
              ...woBase,
              status: {
                notIn: [MaintenanceWorkOrderStatus.done, MaintenanceWorkOrderStatus.cancelled],
              },
              serviceCase: { status: ServiceCaseStatus.active },
            },
          }),
          this.prisma.maintenanceWorkOrder.count({
            where: { ...woBase, quotes: { some: { status: WorkOrderQuoteStatus.submitted } } },
          }),
          this.prisma.maintenanceWorkOrder.count({
            where: {
              ...woBase,
              readyAt: { not: null },
              NOT: { quotes: { some: { invoicedAt: { not: null } } } },
            },
          }),
          this.prisma.serviceAppointment.count({
            where: {
              tenantId: tenant.id,
              supplierId: s.id,
              scheduledAt: { gte: weekStart, lt: weekEnd },
              status: { not: ServiceAppointmentStatus.cancelled },
            },
          }),
        ]);
        return {
          id: s.id,
          code: s.code,
          legalName: s.legalName,
          status: s.status,
          open,
          pendingApproval,
          readyUninvoiced,
          appointmentsThisWeek,
        };
      }),
    );

    const totals = rows.reduce(
      (acc, row) => ({
        open: acc.open + row.open,
        pendingApproval: acc.pendingApproval + row.pendingApproval,
        readyUninvoiced: acc.readyUninvoiced + row.readyUninvoiced,
        appointmentsThisWeek: acc.appointmentsThisWeek + row.appointmentsThisWeek,
        supplierCount: acc.supplierCount + 1,
      }),
      { ...emptyTotals },
    );

    return { totals, suppliers: rows };
  }
}
