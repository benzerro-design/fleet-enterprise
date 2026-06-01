import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, TripSheetDocType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { tripPurposeLabel, tripRoadTypeLabel, tripSheetDocTypeLabel } from './trip-sheet-labels';
import {
  buildTripSheetPdf,
  type FazDailyLine,
  type TripSheetLine,
} from './trip-sheet-pdf';

const MAX_VEHICLES = 20;
const MAX_TRIPS = 800;

export type GenerateTripSheetInput = {
  docType: TripSheetDocType;
  periodStart: string;
  periodEnd: string;
  vehicleIds: string[];
  driverName?: string | null;
  clientId?: string | null;
};

export type TripSheetBrowseFilters = {
  registrationNumber?: string;
  clientId?: string;
  q?: string;
  docType?: TripSheetDocType;
  periodFrom?: string;
  periodTo?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type TripSheetListParams = TripSheetBrowseFilters & {
  page: number;
  pageSize: number;
};

function parseDayStart(s: string): Date {
  const t = s.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T00:00:00.000Z`);
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid periodStart');
  return d;
}

function parseDayEnd(s: string): Date {
  const t = s.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T23:59:59.999Z`);
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid periodEnd');
  return d;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isFuelCategory(category: string): boolean {
  return category.trim().toLowerCase() === 'combustibil';
}

function toDocRow(row: {
  id: string;
  docType: TripSheetDocType;
  periodStart: Date;
  periodEnd: Date;
  vehicleIds: string[];
  driverName: string | null;
  clientIdFilter: string | null;
  title: string;
  summaryJson: Prisma.JsonValue;
  createdAt: Date;
}) {
  return {
    id: row.id,
    docType: row.docType,
    docTypeLabel: tripSheetDocTypeLabel(row.docType),
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    vehicleIds: row.vehicleIds,
    driverName: row.driverName,
    clientIdFilter: row.clientIdFilter,
    title: row.title,
    summary: row.summaryJson,
    createdAt: row.createdAt.toISOString(),
  };
}

async function buildTripSheetWhere(
  prisma: PrismaService,
  tenantId: string,
  f: TripSheetBrowseFilters,
): Promise<Prisma.TripSheetDocumentWhereInput> {
  const parts: Prisma.TripSheetDocumentWhereInput[] = [{ tenantId }];

  if (f.docType) {
    parts.push({ docType: f.docType });
  }

  if (f.clientId?.trim()) {
    const clientId = f.clientId.trim();
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId, clientId: { equals: clientId, mode: 'insensitive' } },
      select: { id: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    const clientParts: Prisma.TripSheetDocumentWhereInput[] = [
      { clientIdFilter: { equals: clientId, mode: 'insensitive' } },
    ];
    if (vehicleIds.length > 0) {
      clientParts.push({ vehicleIds: { hasSome: vehicleIds } });
    }
    parts.push({ OR: clientParts });
  }

  if (f.registrationNumber?.trim()) {
    const reg = f.registrationNumber.trim();
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        registrationNumber: { equals: reg, mode: 'insensitive' },
      },
      select: { id: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    if (vehicleIds.length === 0) {
      return { AND: [{ tenantId }, { id: { in: [] } }] };
    }
    parts.push({ vehicleIds: { hasSome: vehicleIds } });
  }

  if (f.q?.trim()) {
    const q = f.q.trim();
    parts.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { driverName: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  if (f.periodFrom?.trim()) {
    parts.push({ periodEnd: { gte: parseDayStart(f.periodFrom) } });
  }
  if (f.periodTo?.trim()) {
    parts.push({ periodStart: { lte: parseDayEnd(f.periodTo) } });
  }
  if (f.createdFrom?.trim()) {
    parts.push({ createdAt: { gte: parseDayStart(f.createdFrom) } });
  }
  if (f.createdTo?.trim()) {
    parts.push({ createdAt: { lte: parseDayEnd(f.createdTo) } });
  }

  return { AND: parts };
}

@Injectable()
export class TripSheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantSlug: string, params: TripSheetListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const take = Math.min(Math.max(1, params.pageSize), 50);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * take;
    const where = await buildTripSheetWhere(this.prisma, tenant.id, params);
    const [total, rows] = await Promise.all([
      this.prisma.tripSheetDocument.count({ where }),
      this.prisma.tripSheetDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          docType: true,
          periodStart: true,
          periodEnd: true,
          vehicleIds: true,
          driverName: true,
          clientIdFilter: true,
          title: true,
          summaryJson: true,
          createdAt: true,
        },
      }),
    ]);
    return { items: rows.map(toDocRow), total, page, pageSize: take };
  }

  async getById(tenantSlug: string, docId: string) {
    const row = await this.prisma.tripSheetDocument.findFirst({
      where: { id: docId, tenant: { slug: tenantSlug } },
      select: {
        id: true,
        docType: true,
        periodStart: true,
        periodEnd: true,
        vehicleIds: true,
        driverName: true,
        clientIdFilter: true,
        title: true,
        summaryJson: true,
        createdAt: true,
      },
    });
    if (!row) throw new NotFoundException('Document not found');
    return toDocRow(row);
  }

  async getPdfBuffer(tenantSlug: string, docId: string): Promise<Buffer> {
    const row = await this.prisma.tripSheetDocument.findFirst({
      where: { id: docId, tenant: { slug: tenantSlug } },
      select: { pdfData: true },
    });
    if (!row) throw new NotFoundException('Document not found');
    return Buffer.from(row.pdfData as Uint8Array);
  }

  async generate(tenantSlug: string, input: GenerateTripSheetInput, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const periodStart = parseDayStart(input.periodStart);
    const periodEnd = parseDayEnd(input.periodEnd);
    if (periodEnd.getTime() < periodStart.getTime()) {
      throw new BadRequestException('periodEnd must be on or after periodStart');
    }

    const vehicleIds = [...new Set(input.vehicleIds.map((id) => id.trim()).filter(Boolean))];
    if (vehicleIds.length === 0) {
      throw new BadRequestException('Select at least one vehicle');
    }
    if (vehicleIds.length > MAX_VEHICLES) {
      throw new BadRequestException(`Maximum ${MAX_VEHICLES} vehicles per document`);
    }

    const clientFilter = input.clientId?.trim() || null;

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: vehicleIds },
        ...(clientFilter
          ? { clientId: { equals: clientFilter, mode: 'insensitive' as const } }
          : {}),
      },
      select: {
        id: true,
        registrationNumber: true,
        clientId: true,
        brand: true,
        model: true,
        odometerKm: true,
      },
    });
    if (vehicles.length !== vehicleIds.length) {
      throw new BadRequestException('One or more vehicles were not found for this tenant');
    }

    const trips = await this.prisma.trip.findMany({
      where: {
        tenantId: tenant.id,
        vehicleId: { in: vehicleIds },
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      include: {
        vehicle: {
          select: { registrationNumber: true, clientId: true, brand: true, model: true },
        },
      },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      take: MAX_TRIPS,
    });

    const costs = await this.prisma.costEntry.findMany({
      where: {
        tenantId: tenant.id,
        vehicleId: { in: vehicleIds },
        incurredOn: { gte: periodStart, lte: periodEnd },
      },
      select: {
        vehicleId: true,
        category: true,
        amountCents: true,
        fuelLiters: true,
        incurredOn: true,
      },
    });

    const odometerReadings = await this.prisma.odometerReading.findMany({
      where: {
        vehicleId: { in: vehicleIds },
        recordedAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { recordedAt: 'asc' },
      select: { vehicleId: true, odometerKm: true, recordedAt: true },
    });

    const tripLines: TripSheetLine[] = trips.map((t) => ({
      date: t.startedAt.toISOString(),
      registrationNumber: t.vehicle.registrationNumber,
      clientId: t.vehicle.clientId,
      reference: t.reference,
      route: [t.originLabel, t.destLabel].filter(Boolean).join(' → ') || '—',
      distanceKm: t.distanceKm,
      purpose: tripPurposeLabel(t.purpose),
      roadType: tripRoadTypeLabel(t.roadType),
      driverName: t.driverName ?? input.driverName ?? null,
      odometerStartKm: t.odometerStartKm,
      odometerEndKm: t.odometerEndKm,
    }));

    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const fazDailyLines = buildFazDailyLines(trips, costs, odometerReadings, vehicleById);

    let totalDistance = 0;
    let totalFuelLiters = 0;
    let totalFuelCents = 0;
    for (const t of trips) {
      if (t.distanceKm != null) totalDistance += t.distanceKm;
    }
    for (const c of costs) {
      if (isFuelCategory(c.category)) {
        totalFuelCents += c.amountCents;
        if (c.fuelLiters != null) totalFuelLiters += c.fuelLiters;
      }
    }

    const odometerKmValues = odometerReadings.map((r) => r.odometerKm);
    const tripOdoStarts = trips.map((t) => t.odometerStartKm).filter((v): v is number => v != null);
    const tripOdoEnds = trips.map((t) => t.odometerEndKm).filter((v): v is number => v != null);
    const allOdo = [...odometerKmValues, ...tripOdoStarts, ...tripOdoEnds];
    const odometerStartKm = allOdo.length > 0 ? Math.min(...allOdo) : null;
    const odometerEndKm = allOdo.length > 0 ? Math.max(...allOdo) : null;

    const driverName = input.driverName?.trim() || null;
    const periodStartIso = periodStart.toISOString();
    const periodEndIso = periodEnd.toISOString();

    const pdfBuffer = await buildTripSheetPdf({
      docType: input.docType,
      tenantName: tenant.name,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      driverName,
      vehicles: vehicles.map((v) => ({
        registrationNumber: v.registrationNumber,
        clientId: v.clientId,
        brand: v.brand,
        model: v.model,
      })),
      tripLines,
      fazDailyLines,
      totals: {
        tripCount: trips.length,
        distanceKm: totalDistance,
        fuelLiters: totalFuelLiters,
        fuelCostCents: totalFuelCents,
        odometerStartKm,
        odometerEndKm,
      },
    });

    const title = buildTitle(input.docType, periodStart, periodEnd, vehicles);
    const summaryJson = {
      tripCount: trips.length,
      distanceKm: totalDistance,
      fuelLiters: totalFuelLiters,
      fuelCostCents: totalFuelCents,
      odometerStartKm,
      odometerEndKm,
      vehicleCount: vehicles.length,
    };

    const row = await this.prisma.tripSheetDocument.create({
      data: {
        tenantId: tenant.id,
        docType: input.docType,
        periodStart,
        periodEnd,
        vehicleIds,
        driverName,
        clientIdFilter: clientFilter,
        title,
        summaryJson,
        pdfData: Uint8Array.from(pdfBuffer),
        createdByUserId: actorUserId ?? null,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId: actorUserId ?? undefined,
      action: 'create',
      entityType: 'trip_sheet_document',
      entityId: row.id,
      meta: { docType: input.docType, title, vehicleIds },
    });

    return toDocRow({
      id: row.id,
      docType: row.docType,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      vehicleIds: row.vehicleIds,
      driverName: row.driverName,
      clientIdFilter: row.clientIdFilter,
      title: row.title,
      summaryJson: row.summaryJson,
      createdAt: row.createdAt,
    });
  }
}

function buildTitle(
  docType: TripSheetDocType,
  periodStart: Date,
  periodEnd: Date,
  vehicles: Array<{ registrationNumber: string }>,
): string {
  const label = tripSheetDocTypeLabel(docType);
  const from = periodStart.toISOString().slice(0, 10);
  const to = periodEnd.toISOString().slice(0, 10);
  const regs =
    vehicles.length <= 2
      ? vehicles.map((v) => v.registrationNumber).join(', ')
      : `${vehicles.length} vehicule`;
  return `${label} · ${from} – ${to} · ${regs}`;
}

function buildFazDailyLines(
  trips: Array<{
    startedAt: Date;
    distanceKm: number | null;
    odometerStartKm: number | null;
    odometerEndKm: number | null;
    vehicle: { registrationNumber: string; clientId: string };
    vehicleId: string;
  }>,
  costs: Array<{
    vehicleId: string;
    category: string;
    fuelLiters: number | null;
    incurredOn: Date;
  }>,
  odometerReadings: Array<{ vehicleId: string; odometerKm: number; recordedAt: Date }>,
  vehicleById: Map<
    string,
    { registrationNumber: string; clientId: string }
  >,
): FazDailyLine[] {
  const map = new Map<string, FazDailyLine>();

  for (const t of trips) {
    const key = `${dayKey(t.startedAt)}|${t.vehicle.registrationNumber}`;
    const existing = map.get(key);
    const km = t.distanceKm ?? 0;
    if (existing) {
      existing.tripCount += 1;
      existing.distanceKm += km;
      if (t.odometerStartKm != null) {
        existing.odometerStartKm =
          existing.odometerStartKm == null
            ? t.odometerStartKm
            : Math.min(existing.odometerStartKm, t.odometerStartKm);
      }
      if (t.odometerEndKm != null) {
        existing.odometerEndKm =
          existing.odometerEndKm == null
            ? t.odometerEndKm
            : Math.max(existing.odometerEndKm, t.odometerEndKm);
      }
    } else {
      map.set(key, {
        date: t.startedAt.toISOString(),
        registrationNumber: t.vehicle.registrationNumber,
        clientId: t.vehicle.clientId,
        tripCount: 1,
        distanceKm: km,
        fuelLiters: 0,
        odometerStartKm: t.odometerStartKm,
        odometerEndKm: t.odometerEndKm,
      });
    }
  }

  for (const c of costs) {
    if (!isFuelCategory(c.category)) continue;
    const v = vehicleById.get(c.vehicleId);
    if (!v) continue;
    const key = `${dayKey(c.incurredOn)}|${v.registrationNumber}`;
    const line = map.get(key);
    const liters = c.fuelLiters ?? 0;
    if (line) {
      line.fuelLiters += liters;
    } else {
      map.set(key, {
        date: c.incurredOn.toISOString(),
        registrationNumber: v.registrationNumber,
        clientId: v.clientId,
        tripCount: 0,
        distanceKm: 0,
        fuelLiters: liters,
        odometerStartKm: null,
        odometerEndKm: null,
      });
    }
  }

  for (const r of odometerReadings) {
    const v = vehicleById.get(r.vehicleId);
    const reg = v?.registrationNumber;
    const clientId = v?.clientId ?? '';
    if (!reg) continue;
    const key = `${dayKey(r.recordedAt)}|${reg}`;
    const line = map.get(key);
    if (line) {
      line.odometerStartKm =
        line.odometerStartKm == null ? r.odometerKm : Math.min(line.odometerStartKm, r.odometerKm);
      line.odometerEndKm =
        line.odometerEndKm == null ? r.odometerKm : Math.max(line.odometerEndKm, r.odometerKm);
    } else {
      map.set(key, {
        date: r.recordedAt.toISOString(),
        registrationNumber: reg,
        clientId,
        tripCount: 0,
        distanceKm: 0,
        fuelLiters: 0,
        odometerStartKm: r.odometerKm,
        odometerEndKm: r.odometerKm,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.registrationNumber.localeCompare(b.registrationNumber),
  );
}
