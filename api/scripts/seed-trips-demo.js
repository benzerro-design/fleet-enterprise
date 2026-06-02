/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Populează modulul Curse cu date demo (idempotent).
 *
 * Usage (din folderul api):
 *   node scripts/seed-trips-demo.js
 *   TENANT_SLUG=default node scripts/seed-trips-demo.js
 */
const { PrismaClient } = require('@prisma/client');

let defaultPrisma;

function getDefaultPrisma() {
  if (!defaultPrisma) {
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

async function assertSeedSchemaReady(prisma) {
  try {
    await prisma.trip.findFirst({
      select: {
        id: true,
        purpose: true,
        roadType: true,
        driverName: true,
        odometerStartKm: true,
      },
      take: 1,
    });
    await prisma.vehicle.findFirst({
      select: { id: true, brand: true, model: true },
      take: 1,
    });
    await prisma.client.findFirst({ select: { id: true }, take: 1 });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      'Schema DB incompletă pentru Curse/FAZ. Din folderul api rulează:\n' +
        '  npx.cmd prisma migrate deploy\n' +
        'Apoi reîncearcă: npm run db:seed\n\n' +
        `Detaliu: ${detail}`,
    );
  }
}

const SEED_TRIP_REF_PREFIX = 'SEED-TRIP-';
const SEED_COST_NOTE_PREFIX = 'SEED combustibil demo';

const SEED_VEHICLES = [
  {
    registrationNumber: 'B 100 XYZ',
    clientId: 'Client Alpha',
    brand: 'Dacia',
    model: 'Logan',
    type: 'car',
    odometerKm: 45200,
  },
  {
    registrationNumber: 'B 200 ABC',
    clientId: 'Client Alpha',
    brand: 'Volkswagen',
    model: 'Transporter',
    type: 'van_lt_3_5',
    odometerKm: 128400,
  },
  {
    registrationNumber: 'CJ 10 FLE',
    clientId: 'Client Beta',
    brand: 'Mercedes',
    model: 'Actros',
    type: 'tractor_unit',
    odometerKm: 512000,
  },
  {
    registrationNumber: 'IS 55 DRV',
    clientId: 'Client Beta',
    brand: 'Ford',
    model: 'Focus',
    type: 'car',
    odometerKm: 89300,
  },
];

function daysAgo(n, hour = 8, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** @type {Array<{
 *   ref: string;
 *   reg: string;
 *   daysAgoStart: number;
 *   durationHours: number | null;
 *   origin: string;
 *   dest: string;
 *   distanceKm: number;
 *   purpose: 'business' | 'personal' | 'mixed';
 *   roadType: 'urban' | 'extra_urban' | 'highway' | 'mixed';
 *   driverName: string;
 *   odometerStartKm: number;
 *   odometerEndKm: number | null;
 * }>} */
const TRIP_TEMPLATES = [
  {
    ref: 'SEED-TRIP-001',
    reg: 'B 100 XYZ',
    daysAgoStart: 28,
    durationHours: 5,
    origin: 'București',
    dest: 'Ploiești',
    distanceKm: 124,
    purpose: 'business',
    roadType: 'extra_urban',
    driverName: 'Popescu Ion',
    odometerStartKm: 44800,
    odometerEndKm: 44924,
  },
  {
    ref: 'SEED-TRIP-002',
    reg: 'B 100 XYZ',
    daysAgoStart: 21,
    durationHours: 3,
    origin: 'Ploiești',
    dest: 'București',
    distanceKm: 118,
    purpose: 'business',
    roadType: 'highway',
    driverName: 'Popescu Ion',
    odometerStartKm: 44950,
    odometerEndKm: 45068,
  },
  {
    ref: 'SEED-TRIP-003',
    reg: 'B 200 ABC',
    daysAgoStart: 25,
    durationHours: 6,
    origin: 'București',
    dest: 'Brașov',
    distanceKm: 186,
    purpose: 'business',
    roadType: 'highway',
    driverName: 'Ionescu Maria',
    odometerStartKm: 128100,
    odometerEndKm: 128286,
  },
  {
    ref: 'SEED-TRIP-004',
    reg: 'B 200 ABC',
    daysAgoStart: 18,
    durationHours: 4,
    origin: 'Brașov',
    dest: 'Sibiu',
    distanceKm: 145,
    purpose: 'business',
    roadType: 'extra_urban',
    driverName: 'Ionescu Maria',
    odometerStartKm: 128300,
    odometerEndKm: 128445,
  },
  {
    ref: 'SEED-TRIP-005',
    reg: 'CJ 10 FLE',
    daysAgoStart: 30,
    durationHours: 8,
    origin: 'Cluj-Napoca',
    dest: 'Oradea',
    distanceKm: 220,
    purpose: 'business',
    roadType: 'highway',
    driverName: 'Vasilescu Andrei',
    odometerStartKm: 511500,
    odometerEndKm: 511720,
  },
  {
    ref: 'SEED-TRIP-006',
    reg: 'CJ 10 FLE',
    daysAgoStart: 14,
    durationHours: 7,
    origin: 'Oradea',
    dest: 'Timișoara',
    distanceKm: 265,
    purpose: 'business',
    roadType: 'highway',
    driverName: 'Vasilescu Andrei',
    odometerStartKm: 511800,
    odometerEndKm: 512065,
  },
  {
    ref: 'SEED-TRIP-007',
    reg: 'IS 55 DRV',
    daysAgoStart: 12,
    durationHours: 2,
    origin: 'Iași',
    dest: 'Pașcani',
    distanceKm: 42,
    purpose: 'mixed',
    roadType: 'urban',
    driverName: 'Georgescu Dan',
    odometerStartKm: 89100,
    odometerEndKm: 89142,
  },
  {
    ref: 'SEED-TRIP-008',
    reg: 'IS 55 DRV',
    daysAgoStart: 8,
    durationHours: 4,
    origin: 'Iași',
    dest: 'Suceava',
    distanceKm: 138,
    purpose: 'business',
    roadType: 'extra_urban',
    driverName: 'Georgescu Dan',
    odometerStartKm: 89180,
    odometerEndKm: 89318,
  },
  {
    ref: 'SEED-TRIP-009',
    reg: 'B 100 XYZ',
    daysAgoStart: 5,
    durationHours: 1,
    origin: 'București',
    dest: 'Otopeni',
    distanceKm: 22,
    purpose: 'personal',
    roadType: 'urban',
    driverName: 'Popescu Ion',
    odometerStartKm: 45100,
    odometerEndKm: 45122,
  },
  {
    ref: 'SEED-TRIP-010',
    reg: 'B 200 ABC',
    daysAgoStart: 2,
    durationHours: null,
    origin: 'București',
    dest: 'Constanța',
    distanceKm: null,
    purpose: 'business',
    roadType: 'highway',
    driverName: 'Ionescu Maria',
    odometerStartKm: 128450,
    odometerEndKm: null,
  },
  {
    ref: 'SEED-TRIP-011',
    reg: 'IS 55 DRV',
    daysAgoStart: 35,
    durationHours: 5,
    origin: 'Galați',
    dest: 'Iași',
    distanceKm: 195,
    purpose: 'business',
    roadType: 'mixed',
    driverName: 'Georgescu Dan',
    odometerStartKm: 88800,
    odometerEndKm: 88995,
  },
  {
    ref: 'SEED-TRIP-012',
    reg: 'CJ 10 FLE',
    daysAgoStart: 7,
    durationHours: 6,
    origin: 'Dej',
    dest: 'Cluj-Napoca',
    distanceKm: 58,
    purpose: 'business',
    roadType: 'extra_urban',
    driverName: 'Vasilescu Andrei',
    odometerStartKm: 512100,
    odometerEndKm: 512158,
  },
];

/** @type {Array<{ reg: string; daysAgo: number; liters: number; amountCents: number }>} */
const FUEL_COSTS = [
  { reg: 'B 100 XYZ', daysAgo: 28, liters: 38.5, amountCents: 31500 },
  { reg: 'B 100 XYZ', daysAgo: 21, liters: 36.2, amountCents: 29800 },
  { reg: 'B 200 ABC', daysAgo: 25, liters: 52.0, amountCents: 44200 },
  { reg: 'B 200 ABC', daysAgo: 18, liters: 41.5, amountCents: 35100 },
  { reg: 'CJ 10 FLE', daysAgo: 30, liters: 180.0, amountCents: 125000 },
  { reg: 'CJ 10 FLE', daysAgo: 14, liters: 195.5, amountCents: 138200 },
  { reg: 'IS 55 DRV', daysAgo: 12, liters: 28.0, amountCents: 23100 },
  { reg: 'IS 55 DRV', daysAgo: 8, liters: 35.4, amountCents: 28900 },
];

async function ensureClient(prisma, tenantId, code, legalName) {
  const trimmed = code.trim();
  const existing = await prisma.client.findFirst({
    where: { tenantId, code: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  const created = await prisma.client.create({
    data: {
      tenantId,
      code: trimmed,
      legalName: legalName.trim() || trimmed,
      status: 'active',
    },
  });
  return created.id;
}

async function upsertSeedVehicles(prisma, tenantId, adminUserId) {
  const byReg = new Map();
  for (const v of SEED_VEHICLES) {
    const clientFk = await ensureClient(prisma, tenantId, v.clientId, v.clientId);
    const row = await prisma.vehicle.upsert({
      where: {
        tenantId_registrationNumber: {
          tenantId,
          registrationNumber: v.registrationNumber,
        },
      },
      create: {
        tenantId,
        clientId: clientFk,
        registrationNumber: v.registrationNumber,
        type: v.type,
        brand: v.brand,
        model: v.model,
        status: 'active',
        odometerKm: v.odometerKm,
        createdByUserId: adminUserId ?? undefined,
        updatedByUserId: adminUserId ?? undefined,
      },
      update: {
        clientId: clientFk,
        brand: v.brand,
        model: v.model,
        odometerKm: v.odometerKm,
        updatedByUserId: adminUserId ?? undefined,
      },
    });
    byReg.set(v.registrationNumber, row);
  }
  return byReg;
}

async function seedTripsForTenant(tenantSlug, prismaOverride) {
  const prisma = prismaOverride ?? getDefaultPrisma();
  await assertSeedSchemaReady(prisma);

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    throw new Error(`Tenant "${tenantSlug}" not found. Create it first (npm run db:seed).`);
  }

  const admin = await prisma.user.findFirst({
    where: {
      email: 'admin@demo.local',
      memberships: { some: { tenantId: tenant.id } },
    },
  });

  const vehiclesByReg = await upsertSeedVehicles(prisma, tenant.id, admin?.id ?? null);

  await prisma.trip.deleteMany({
    where: {
      tenantId: tenant.id,
      reference: { startsWith: SEED_TRIP_REF_PREFIX },
    },
  });

  let tripCount = 0;
  for (const t of TRIP_TEMPLATES) {
    const vehicle = vehiclesByReg.get(t.reg);
    if (!vehicle) continue;
    const startedAt = daysAgo(t.daysAgoStart, 7 + (tripCount % 4));
    const endedAt = t.durationHours != null ? addHours(startedAt, t.durationHours) : null;
    await prisma.trip.create({
      data: {
        tenantId: tenant.id,
        vehicleId: vehicle.id,
        reference: t.ref,
        startedAt,
        endedAt,
        originLabel: t.origin,
        destLabel: t.dest,
        distanceKm: t.distanceKm,
        purpose: t.purpose,
        roadType: t.roadType,
        driverName: t.driverName,
        odometerStartKm: t.odometerStartKm,
        odometerEndKm: t.odometerEndKm,
      },
    });
    tripCount += 1;
  }

  await prisma.costEntry.deleteMany({
    where: {
      tenantId: tenant.id,
      notes: { startsWith: SEED_COST_NOTE_PREFIX },
    },
  });

  let fuelCount = 0;
  for (const f of FUEL_COSTS) {
    const vehicle = vehiclesByReg.get(f.reg);
    if (!vehicle) continue;
    const incurredOn = daysAgo(f.daysAgo, 16);
    await prisma.costEntry.create({
      data: {
        tenantId: tenant.id,
        vehicleId: vehicle.id,
        category: 'Combustibil',
        amountCents: f.amountCents,
        fuelLiters: f.liters,
        incurredOn,
        notes: `${SEED_COST_NOTE_PREFIX} — ${f.reg}`,
        odometerKm: vehicle.odometerKm,
      },
    });
    fuelCount += 1;
  }

  return { tenantSlug, tripCount, fuelCount, vehicleCount: vehiclesByReg.size };
}

async function main() {
  const prisma = getDefaultPrisma();
  const explicit = process.env.TENANT_SLUG?.trim();
  const slugs = explicit ? [explicit] : ['demo', 'default'];

  for (const slug of slugs) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      // eslint-disable-next-line no-console
      console.warn(`Skip tenant "${slug}" — not found.`);
      continue;
    }
    const result = await seedTripsForTenant(slug, prisma);
    // eslint-disable-next-line no-console
    console.log(
      `Trips seed OK — tenant: ${result.tenantSlug}, ${result.tripCount} curse, ${result.fuelCount} costuri combustibil, ${result.vehicleCount} vehicule demo.`,
    );
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      if (defaultPrisma) {
        await defaultPrisma.$disconnect();
        defaultPrisma = null;
      }
    });
}

module.exports = { seedTripsForTenant, assertSeedSchemaReady };
