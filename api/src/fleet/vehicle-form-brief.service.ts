import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../iam/access-context.types';
import { assertVehicleOpsRead } from '../ops/ops-write-access';
import { PrismaService } from '../prisma/prisma.service';

export type ComplianceStatus = 'valid' | 'expired' | 'missing';

export type VehicleFormBriefComplianceItem = {
  status: ComplianceStatus;
  expiresOn: string | null;
};

export type VehicleFormBriefRevision = {
  title: string;
  performedOn: string;
  odometerKm: number | null;
};

export type VehicleFormBriefEntry = {
  id: string;
  cells: string[];
  detail: Record<string, string>;
};

export type VehicleFormBriefModule = {
  total: number;
  entries: VehicleFormBriefEntry[];
};

export type VehicleFormBriefPayload = {
  vehicle: {
    id: string;
    registrationNumber: string;
    clientId: string;
    clientLegalName: string | null;
    odometerKm: number;
    itpExpiresOn: string | null;
    brand: string | null;
    model: string | null;
  };
  compliance: {
    rca: VehicleFormBriefComplianceItem;
    casco: VehicleFormBriefComplianceItem;
    vignette: VehicleFormBriefComplianceItem;
  };
  lastPeriodicRevision: VehicleFormBriefRevision | null;
  modules: {
    maintenance: VehicleFormBriefModule;
    costs: VehicleFormBriefModule;
    documents: VehicleFormBriefModule;
    reminders: VehicleFormBriefModule;
    trips: VehicleFormBriefModule;
  };
};

const BRIEF_FETCH_CAP = 500;

function fmtDateRo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ro-RO');
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

function fmtRon(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function complianceFromDoc(
  docs: Array<{ expiresOn: Date | null }>,
  now: Date,
): VehicleFormBriefComplianceItem {
  if (docs.length === 0) return { status: 'missing', expiresOn: null };
  const latest = docs.reduce((a, b) => {
    const aT = a.expiresOn?.getTime() ?? 0;
    const bT = b.expiresOn?.getTime() ?? 0;
    return bT >= aT ? b : a;
  });
  if (!latest.expiresOn) return { status: 'valid', expiresOn: null };
  const iso = latest.expiresOn.toISOString();
  return {
    status: latest.expiresOn < now ? 'expired' : 'valid',
    expiresOn: iso,
  };
}

function vignetteCompliance(
  docs: Array<{ title: string; expiresOn: Date | null }>,
  now: Date,
): VehicleFormBriefComplianceItem {
  const matches = docs.filter((d) => /vignet/i.test(d.title));
  return complianceFromDoc(matches, now);
}

@Injectable()
export class VehicleFormBriefService {
  constructor(private readonly prisma: PrismaService) {}

  async getBrief(tenantSlug: string, vehicleId: string, access?: AccessContext): Promise<VehicleFormBriefPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const now = new Date();

    const [
      vehicle,
      documents,
      maintenanceRows,
      costRows,
      reminderRows,
      tripRows,
      lastRevision,
    ] = await Promise.all([
      this.prisma.vehicle.findFirst({
        where: { id: vehicleId, tenant: { slug: tenantSlug } },
        select: {
          id: true,
          registrationNumber: true,
          odometerKm: true,
          itpExpiresOn: true,
          brand: true,
          model: true,
          client: { select: { code: true, legalName: true } },
        },
      }),
      this.prisma.vehicleDocument.findMany({
        where: { vehicleId },
        orderBy: [{ expiresOn: 'desc' }, { title: 'asc' }],
        select: {
          id: true,
          title: true,
          documentTypeCode: true,
          expiresOn: true,
          fileUrl: true,
        },
      }),
      this.prisma.maintenanceEntry.findMany({
        where: { vehicleId },
        orderBy: [{ performedAt: 'desc' }, { title: 'asc' }],
        take: BRIEF_FETCH_CAP,
        select: {
          id: true,
          title: true,
          provider: true,
          costAllocationCode: true,
          performedAt: true,
          odometerKm: true,
          costCents: true,
          invoiceNumber: true,
          notes: true,
        },
      }),
      this.prisma.costEntry.findMany({
        where: { vehicleId },
        orderBy: { incurredOn: 'desc' },
        take: BRIEF_FETCH_CAP,
        select: {
          id: true,
          category: true,
          provider: true,
          amountCents: true,
          odometerKm: true,
          fuelLiters: true,
          invoiceNumber: true,
          invoiceDate: true,
          incurredOn: true,
          notes: true,
        },
      }),
      this.prisma.reminderAction.findMany({
        where: { vehicleId, isActive: true },
        orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
        take: BRIEF_FETCH_CAP,
        select: {
          id: true,
          title: true,
          sourceType: true,
          dueOn: true,
          dueOdometerKm: true,
          notes: true,
        },
      }),
      this.prisma.trip.findMany({
        where: { vehicleId },
        orderBy: { startedAt: 'desc' },
        take: BRIEF_FETCH_CAP,
        select: {
          id: true,
          reference: true,
          startedAt: true,
          endedAt: true,
          originLabel: true,
          destLabel: true,
          distanceKm: true,
          odometerStartKm: true,
          odometerEndKm: true,
          driverName: true,
        },
      }),
      this.prisma.maintenanceEntry.findFirst({
        where: { vehicleId, costAllocationCode: 'revizie' },
        orderBy: [{ performedAt: 'desc' }, { title: 'asc' }],
        select: { title: true, performedAt: true, odometerKm: true },
      }),
    ]);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    const rcaDocs = documents.filter((d) => d.documentTypeCode === 'rca');
    const cascoDocs = documents.filter((d) => d.documentTypeCode === 'casco');

    const maintenanceTotal = await this.prisma.maintenanceEntry.count({ where: { vehicleId } });
    const costsTotal = await this.prisma.costEntry.count({ where: { vehicleId } });
    const documentsTotal = documents.length;
    const remindersTotal = await this.prisma.reminderAction.count({
      where: { vehicleId, isActive: true },
    });
    const tripsTotal = await this.prisma.trip.count({ where: { vehicleId } });

    return {
      vehicle: {
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        clientId: vehicle.client.code,
        clientLegalName: vehicle.client.legalName,
        odometerKm: vehicle.odometerKm,
        itpExpiresOn: vehicle.itpExpiresOn ? vehicle.itpExpiresOn.toISOString() : null,
        brand: vehicle.brand,
        model: vehicle.model,
      },
      compliance: {
        rca: complianceFromDoc(rcaDocs, now),
        casco: complianceFromDoc(cascoDocs, now),
        vignette: vignetteCompliance(documents, now),
      },
      lastPeriodicRevision: lastRevision?.performedAt
        ? {
            title: lastRevision.title,
            performedOn: lastRevision.performedAt.toISOString(),
            odometerKm: lastRevision.odometerKm,
          }
        : null,
      modules: {
        maintenance: {
          total: maintenanceTotal,
          entries: maintenanceRows.map((m) => ({
            id: m.id,
            cells: [
              fmtDateShort(m.performedAt?.toISOString() ?? null),
              m.title.length > 18 ? `${m.title.slice(0, 18)}…` : m.title,
              m.provider ?? '—',
              m.costCents != null ? `${fmtRon(m.costCents)} RON` : '—',
            ],
            detail: {
              Titlu: m.title,
              Data: fmtDateRo(m.performedAt?.toISOString() ?? null),
              Furnizor: m.provider ?? '—',
              Cost: m.costCents != null ? `${fmtRon(m.costCents)} RON (fără TVA)` : '—',
              Km: m.odometerKm != null ? m.odometerKm.toLocaleString('ro-RO') : '—',
              Alocare: m.costAllocationCode ?? '—',
              Factură: m.invoiceNumber ?? '—',
              Note: m.notes ?? '—',
            },
          })),
        },
        costs: {
          total: costsTotal,
          entries: costRows.map((c) => ({
            id: c.id,
            cells: [
              fmtDateShort(c.incurredOn.toISOString()),
              c.category.length > 12 ? `${c.category.slice(0, 12)}…` : c.category,
              fmtRon(c.amountCents),
              c.provider ?? '—',
            ],
            detail: {
              Categorie: c.category,
              Data: fmtDateRo(c.incurredOn.toISOString()),
              Sumă: `${fmtRon(c.amountCents)} RON (fără TVA)`,
              Furnizor: c.provider ?? '—',
              Km: c.odometerKm != null ? c.odometerKm.toLocaleString('ro-RO') : '—',
              Litri: c.fuelLiters != null ? String(c.fuelLiters) : '—',
              Factură: c.invoiceNumber ?? '—',
              'Data facturii': fmtDateRo(c.invoiceDate?.toISOString() ?? null),
              Note: c.notes ?? '—',
            },
          })),
        },
        documents: {
          total: documentsTotal,
          entries: documents.map((d) => ({
            id: d.id,
            cells: [
              d.title.length > 16 ? `${d.title.slice(0, 16)}…` : d.title,
              d.documentTypeCode,
              fmtDateShort(d.expiresOn?.toISOString() ?? null),
            ],
            detail: {
              Titlu: d.title,
              Tip: d.documentTypeCode,
              Expiră: fmtDateRo(d.expiresOn?.toISOString() ?? null),
              Fișier: d.fileUrl ? 'Da' : '—',
            },
          })),
        },
        reminders: {
          total: remindersTotal,
          entries: reminderRows.map((r) => ({
            id: r.id,
            cells: [
              r.title.length > 18 ? `${r.title.slice(0, 18)}…` : r.title,
              fmtDateShort(r.dueOn?.toISOString() ?? null),
              r.dueOdometerKm != null ? `${r.dueOdometerKm.toLocaleString('ro-RO')} km` : '—',
            ],
            detail: {
              Titlu: r.title,
              Scadență: fmtDateRo(r.dueOn?.toISOString() ?? null),
              'Km scadență': r.dueOdometerKm != null ? r.dueOdometerKm.toLocaleString('ro-RO') : '—',
              Sursă: r.sourceType,
              Note: r.notes ?? '—',
            },
          })),
        },
        trips: {
          total: tripsTotal,
          entries: tripRows.map((t) => ({
            id: t.id,
            cells: [
              fmtDateShort(t.startedAt.toISOString()),
              [t.originLabel, t.destLabel].filter(Boolean).join(' → ') || '—',
              t.distanceKm != null ? `${t.distanceKm} km` : '—',
            ],
            detail: {
              Referință: t.reference ?? '—',
              Plecare: fmtDateRo(t.startedAt.toISOString()),
              Sosire: fmtDateRo(t.endedAt?.toISOString() ?? null),
              Origine: t.originLabel ?? '—',
              Destinație: t.destLabel ?? '—',
              Distanță: t.distanceKm != null ? `${t.distanceKm} km` : '—',
              'Km start': t.odometerStartKm != null ? t.odometerStartKm.toLocaleString('ro-RO') : '—',
              'Km sfârșit': t.odometerEndKm != null ? t.odometerEndKm.toLocaleString('ro-RO') : '—',
              Șofer: t.driverName ?? '—',
            },
          })),
        },
      },
    };
  }
}
