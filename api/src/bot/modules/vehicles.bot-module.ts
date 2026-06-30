import type { AccessContext } from '../../iam/access-context.types';
import type {
  BotFindingInput,
  BotModuleOperations,
  BotRunContext,
  BotStepResult,
} from '../bot.types';
import { BOT_REF_PREFIX } from '../bot.types';
import { botRef, daysAgoFromSeed, divisionClientCodes } from '../bot-scenarios';
import { PrismaService } from '../../prisma/prisma.service';

const SEED_VEHICLES = [
  {
    registrationNumber: 'B 100 XYZ',
    clientCode: 'Client Alpha',
    brand: 'Dacia',
    model: 'Logan',
    type: 'car' as const,
    odometerKm: 45200,
  },
  {
    registrationNumber: 'B 200 ABC',
    clientCode: 'Client Alpha',
    brand: 'Volkswagen',
    model: 'Transporter',
    type: 'van_lt_3_5' as const,
    odometerKm: 128400,
  },
  {
    registrationNumber: 'CJ 10 FLE',
    clientCode: 'Client Beta',
    brand: 'Mercedes',
    model: 'Actros',
    type: 'tractor_unit' as const,
    odometerKm: 512000,
  },
  {
    registrationNumber: 'IS 55 DRV',
    clientCode: 'Client Beta',
    brand: 'Ford',
    model: 'Focus',
    type: 'car' as const,
    odometerKm: 89300,
  },
];

export async function runVehiclesBotModule(
  prisma: PrismaService,
  ctx: BotRunContext,
  ops: BotModuleOperations,
  access: AccessContext,
  onFinding: (f: BotFindingInput) => void,
): Promise<BotStepResult> {
  const result: BotStepResult = { created: 0, edited: 0, deleted: 0, failed: 0, skipped: 0 };
  const clientCodes = divisionClientCodes(ctx.division);
  const vehicles = SEED_VEHICLES.filter((v) => clientCodes.includes(v.clientCode));

  const clients = await prisma.client.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, code: true },
  });
  const clientByCode = new Map(clients.map((c) => [c.code.toLowerCase(), c.id]));

  const createN = Math.max(0, ops.create ?? 0);
  const editN = Math.max(0, ops.edit ?? 0);
  const deleteN = Math.max(0, ops.delete ?? 0);

  if (createN > 0) {
    for (let i = 0; i < Math.min(createN, vehicles.length); i++) {
      const tpl = vehicles[i % vehicles.length];
      const clientId = clientByCode.get(tpl.clientCode.toLowerCase());
      if (!clientId) {
        result.failed++;
        onFinding({
          moduleId: 'vehicles',
          severity: 'error',
          message: `Client lipsă: ${tpl.clientCode}`,
          links: [{ label: 'Clienți demo', href: '/fleet/clients' }],
          remediation: 'Rulează npm run db:seed în folderul api.',
        });
        continue;
      }
      const reg = `${BOT_REF_PREFIX}${ctx.sessionId.slice(-4)}-${i + 1}`.replace(/\s/g, '');
      try {
        await prisma.vehicle.upsert({
          where: {
            tenantId_registrationNumber: { tenantId: ctx.tenantId, registrationNumber: reg },
          },
          create: {
            tenantId: ctx.tenantId,
            clientId,
            registrationNumber: reg,
            type: tpl.type,
            brand: tpl.brand,
            model: tpl.model,
            status: 'active',
            odometerKm: tpl.odometerKm + i * 100,
            createdByUserId: access.userId,
            updatedByUserId: access.userId,
          },
          update: {
            odometerKm: tpl.odometerKm + i * 100,
            updatedByUserId: access.userId,
          },
        });
        result.created++;
      } catch (e) {
        result.failed++;
        onFinding({
          moduleId: 'vehicles',
          severity: 'error',
          message: e instanceof Error ? e.message : 'Create vehicle failed',
          links: [{ label: 'Vehicule', href: '/fleet/vehicles' }],
        });
      }
    }
  }

  const allowedClientIds = new Set(
    clients
      .filter((c) => clientCodes.map((x) => x.toLowerCase()).includes(c.code.toLowerCase()))
      .map((c) => c.id),
  );

  const pool = await prisma.vehicle.findMany({
    where: {
      tenantId: ctx.tenantId,
      clientId: { in: [...allowedClientIds] },
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.max(editN, deleteN, 1),
  });

  for (let i = 0; i < editN && i < pool.length; i++) {
    const v = pool[i];
    const coherent = ops.options?.coherentOdometer !== false;
    const delta = coherent ? 50 + i * 10 : -500;
    const nextKm = Math.max(0, (v.odometerKm ?? 0) + delta);
    try {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { odometerKm: nextKm, updatedByUserId: access.userId },
      });
      result.edited++;
      if (!coherent) {
        onFinding({
          moduleId: 'vehicles',
          severity: 'warning',
          message: `Odometru scăzut intenționat pe ${v.registrationNumber}`,
          links: [{ label: v.registrationNumber, href: `/fleet/vehicles/${v.id}` }],
          entityRefs: [{ type: 'vehicle', id: v.id, label: v.registrationNumber }],
          remediation: 'Verifică alertele de conformitate în detaliu vehicul.',
        });
      }
    } catch {
      result.failed++;
    }
  }

  const botVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId: ctx.tenantId,
      registrationNumber: { startsWith: BOT_REF_PREFIX },
    },
    take: deleteN,
  });
  for (const v of botVehicles) {
    const tripCount = await prisma.trip.count({ where: { vehicleId: v.id } });
    if (tripCount > 0) {
      result.skipped++;
      onFinding({
        moduleId: 'vehicles',
        severity: 'info',
        message: `Skip delete ${v.registrationNumber} — are curse`,
        links: [{ label: 'Vehicul', href: `/fleet/vehicles/${v.id}` }],
      });
      continue;
    }
    try {
      await prisma.vehicle.delete({ where: { id: v.id } });
      result.deleted++;
    } catch {
      result.failed++;
    }
  }

  return { ...result, meta: { vehiclePool: pool.length } };
}
