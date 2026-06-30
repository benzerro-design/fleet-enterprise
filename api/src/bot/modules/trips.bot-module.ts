import type { AccessContext } from '../../iam/access-context.types';
import type {
  BotFindingInput,
  BotModuleOperations,
  BotRunContext,
  BotStepResult,
} from '../bot.types';
import { BOT_REF_PREFIX } from '../bot.types';
import { addHours, botRef, daysAgoFromSeed, divisionClientCodes, seededRandom } from '../bot-scenarios';
import { PrismaService } from '../../prisma/prisma.service';
import { TripsService } from '../../ops/trips.service';

type TripTemplate = {
  reg: string;
  clientCode: string;
  daysAgo: number;
  hours: number | null;
  origin: string;
  dest: string;
  distanceKm: number | null;
  driverName: string;
  odometerStart: number;
  odometerEnd: number | null;
};

const TRIP_TEMPLATES: TripTemplate[] = [
  {
    reg: 'B 100 XYZ',
    clientCode: 'Client Alpha',
    daysAgo: 14,
    hours: 5,
    origin: 'București',
    dest: 'Ploiești',
    distanceKm: 124,
    driverName: 'Popescu Ion',
    odometerStart: 45100,
    odometerEnd: 45224,
  },
  {
    reg: 'B 200 ABC',
    clientCode: 'Client Alpha',
    daysAgo: 10,
    hours: 3,
    origin: 'București',
    dest: 'Pitești',
    distanceKm: 116,
    driverName: 'Ionescu Maria',
    odometerStart: 128400,
    odometerEnd: 128516,
  },
  {
    reg: 'IS 55 DRV',
    clientCode: 'Client Beta',
    daysAgo: 7,
    hours: 4,
    origin: 'Iași',
    dest: 'Suceava',
    distanceKm: 138,
    driverName: 'Georgescu Dan',
    odometerStart: 89180,
    odometerEnd: 89318,
  },
  {
    reg: 'CJ 10 FLE',
    clientCode: 'Client Beta',
    daysAgo: 5,
    hours: 6,
    origin: 'Dej',
    dest: 'Cluj-Napoca',
    distanceKm: 58,
    driverName: 'Vasilescu Andrei',
    odometerStart: 512100,
    odometerEnd: 512158,
  },
  {
    reg: 'B 100 XYZ',
    clientCode: 'Client Alpha',
    daysAgo: 2,
    hours: null,
    origin: 'București',
    dest: 'Constanța',
    distanceKm: null,
    driverName: 'Popescu Ion',
    odometerStart: 45250,
    odometerEnd: null,
  },
];

export async function runTripsBotModule(
  prisma: PrismaService,
  trips: TripsService,
  ctx: BotRunContext,
  ops: BotModuleOperations,
  access: AccessContext,
  onFinding: (f: BotFindingInput) => void,
): Promise<BotStepResult> {
  const result: BotStepResult = { created: 0, edited: 0, deleted: 0, failed: 0, skipped: 0 };
  const clientCodes = divisionClientCodes(ctx.division);
  const templates = TRIP_TEMPLATES.filter((t) => clientCodes.includes(t.clientCode));
  const rng = seededRandom(ctx.seed);

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, registrationNumber: true, odometerKm: true },
  });
  const byReg = new Map(vehicles.map((v) => [v.registrationNumber, v]));

  const createN = Math.max(0, ops.create ?? 0);
  for (let i = 0; i < createN; i++) {
    const tpl = templates[i % templates.length];
    const vehicle = byReg.get(tpl.reg);
    if (!vehicle) {
      result.skipped++;
      onFinding({
        moduleId: 'trips',
        severity: 'warning',
        message: `Vehicul ${tpl.reg} lipsește — rulează seed sau modul vehicule`,
        links: [{ label: 'Vehicule', href: '/fleet/vehicles' }],
        remediation: 'npm run db:seed sau create vehicule în sesiune BOT.',
      });
      continue;
    }
    const ref = botRef(ctx.sessionId, 'trips', i + 1);
    const daysBack = tpl.daysAgo + Math.floor(rng() * 3);
    const startedAt = daysAgoFromSeed(ctx.seed + i, daysBack, 7 + (i % 4));
    const endedAt = tpl.hours != null ? addHours(startedAt, tpl.hours) : null;
    const odoStart = tpl.odometerStart + i * 20;
    const odoEnd = tpl.odometerEnd != null ? tpl.odometerEnd + i * 20 : null;

    try {
      const row = await trips.create(
        ctx.tenantSlug,
        {
          vehicleId: vehicle.id,
          reference: ref,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt?.toISOString() ?? null,
          originLabel: tpl.origin,
          destLabel: tpl.dest,
          distanceKm: tpl.distanceKm,
          purpose: 'business',
          roadType: 'mixed',
          odometerStartKm: odoStart,
          odometerEndKm: odoEnd,
          driverName: tpl.driverName,
        },
        access.userId,
        access,
      );
      result.created++;
      if (odoEnd != null && vehicle.odometerKm != null && odoEnd < vehicle.odometerKm) {
        onFinding({
          moduleId: 'trips',
          severity: 'warning',
          message: `Km cursă ${ref} sub odometru vehicul`,
          links: [
            { label: 'Cursă', href: `/fleet/trips/${row.id}` },
            { label: 'Vehicul', href: `/fleet/vehicles/${vehicle.id}` },
          ],
          entityRefs: [
            { type: 'trip', id: row.id, label: ref },
            { type: 'vehicle', id: vehicle.id, label: vehicle.registrationNumber },
          ],
          remediation: 'Verifică sincronizarea odometru în detaliu vehicul.',
        });
      }
    } catch (e) {
      result.failed++;
      onFinding({
        moduleId: 'trips',
        severity: 'error',
        message: e instanceof Error ? e.message : 'Create trip failed',
        links: [{ label: 'Curse', href: '/fleet/trips' }],
      });
    }
  }

  const editN = Math.max(0, ops.edit ?? 0);
  if (editN > 0 && ops.options?.closeOpenTrips !== false) {
    const openTrips = await prisma.trip.findMany({
      where: {
        tenantId: ctx.tenantId,
        endedAt: null,
        OR: [
          { reference: { startsWith: BOT_REF_PREFIX } },
          { reference: { startsWith: 'SEED-TRIP-' } },
        ],
      },
      take: editN,
      orderBy: { startedAt: 'desc' },
    });
    for (const trip of openTrips) {
      try {
        const endKm = (trip.odometerStartKm ?? 0) + 45;
        await trips.patch(
          ctx.tenantSlug,
          trip.id,
          {
            endedAt: addHours(trip.startedAt, 4).toISOString(),
            odometerEndKm: endKm,
            distanceKm: 45,
          },
          access.userId,
          access,
        );
        result.edited++;
        onFinding({
          moduleId: 'trips',
          severity: 'info',
          message: `Cursă deschisă închisă: ${trip.reference ?? trip.id}`,
          links: [{ label: 'Cursă', href: `/fleet/trips/${trip.id}` }],
          entityRefs: [{ type: 'trip', id: trip.id }],
        });
      } catch {
        result.failed++;
      }
    }
  }

  const deleteN = Math.max(0, ops.delete ?? 0);
  if (deleteN > 0) {
    const botTrips = await prisma.trip.findMany({
      where: {
        tenantId: ctx.tenantId,
        reference: { startsWith: BOT_REF_PREFIX },
      },
      take: deleteN,
      orderBy: { startedAt: 'desc' },
    });
    for (const trip of botTrips) {
      try {
        await trips.delete(ctx.tenantSlug, trip.id, access.userId, access);
        result.deleted++;
      } catch {
        result.failed++;
      }
    }
  }

  return result;
}

export async function runTripFaultTests(
  prisma: PrismaService,
  trips: TripsService,
  ctx: BotRunContext,
  faultIds: string[],
  access: AccessContext,
  onFinding: (f: BotFindingInput) => void,
): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: 'asc' },
  });
  if (!vehicle) return;

  if (faultIds.includes('validation_bad_odometer')) {
    try {
      await trips.create(
        ctx.tenantSlug,
        {
          vehicleId: vehicle.id,
          reference: botRef(ctx.sessionId, 'fault', 999),
          odometerStartKm: 5000,
          odometerEndKm: 4000,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        },
        access.userId,
        access,
      );
      onFinding({
        moduleId: 'trips',
        severity: 'error',
        faultId: 'validation_bad_odometer',
        expected: true,
        message: 'Fault validation_bad_odometer: API a acceptat km invalid (neașteptat)',
        links: [{ label: 'Curse', href: '/fleet/trips' }],
        remediation: 'Verifică validarea odometru în TripsService.',
      });
    } catch (e) {
      onFinding({
        moduleId: 'trips',
        severity: 'expected',
        faultId: 'validation_bad_odometer',
        expected: true,
        message: `Fault validation_bad_odometer: respins corect — ${e instanceof Error ? e.message : 'error'}`,
        links: [{ label: 'Audit', href: '/fleet/audit' }],
      });
    }
  }

  if (faultIds.includes('conflict_duplicate_reference')) {
    const ref = botRef(ctx.sessionId, 'dup', 1);
    const payload = {
      vehicleId: vehicle.id,
      reference: ref,
      startedAt: new Date().toISOString(),
      originLabel: 'Test',
      destLabel: 'Test',
    };
    try {
      await trips.create(ctx.tenantSlug, payload, access.userId, access);
      await trips.create(ctx.tenantSlug, payload, access.userId, access);
      onFinding({
        moduleId: 'trips',
        severity: 'warning',
        faultId: 'conflict_duplicate_reference',
        expected: true,
        message: 'Fault conflict: a doua cursă cu aceeași referință a reușit (verifică unicitate)',
        links: [{ label: 'Curse filtrate', href: `/fleet/trips?q=${encodeURIComponent(ref)}` }],
      });
    } catch (e) {
      onFinding({
        moduleId: 'trips',
        severity: 'expected',
        faultId: 'conflict_duplicate_reference',
        expected: true,
        message: `Fault conflict: duplicat respins — ${e instanceof Error ? e.message : 'error'}`,
        links: [{ label: 'Curse', href: '/fleet/trips' }],
      });
    }
  }
}
