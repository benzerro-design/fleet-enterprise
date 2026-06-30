import type { AccessContext } from '../iam/access-context.types';
import type { DriversService } from '../drivers/drivers.service';
import { PrismaService } from '../prisma/prisma.service';

export function normalizeDriverName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type BotDriverIndex = Map<string, Map<string, { id: string; fullName: string }>>;

export async function loadBotDriverIndex(prisma: PrismaService, tenantId: string): Promise<BotDriverIndex> {
  const rows = await prisma.driver.findMany({
    where: { tenantId, status: 'active' },
    select: { id: true, fullName: true, clientId: true },
  });
  const index: BotDriverIndex = new Map();
  for (const row of rows) {
    indexDriver(index, row.clientId, { id: row.id, fullName: row.fullName });
  }
  return index;
}

export function indexDriver(
  index: BotDriverIndex,
  clientId: string,
  driver: { id: string; fullName: string },
): void {
  const byName = index.get(clientId) ?? new Map();
  byName.set(normalizeDriverName(driver.fullName), driver);
  index.set(clientId, byName);
}

export type ResolveBotDriverResult = {
  driverId: string | null;
  driverFullName: string;
  created: boolean;
  source: 'index' | 'db' | 'created' | 'missing';
};

export async function resolveBotDriverForTrip(input: {
  prisma: PrismaService;
  drivers: DriversService;
  tenantId: string;
  tenantSlug: string;
  clientId: string;
  driverName: string;
  index: BotDriverIndex;
  createIfMissing: boolean;
  actorUserId?: string;
  access?: AccessContext;
}): Promise<ResolveBotDriverResult> {
  const name = input.driverName.trim();
  if (!name) {
    return { driverId: null, driverFullName: name, created: false, source: 'missing' };
  }

  const cached = input.index.get(input.clientId)?.get(normalizeDriverName(name));
  if (cached) {
    return { driverId: cached.id, driverFullName: cached.fullName, created: false, source: 'index' };
  }

  const fromDb = await input.prisma.driver.findFirst({
    where: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      fullName: { equals: name, mode: 'insensitive' },
    },
    select: { id: true, fullName: true },
  });
  if (fromDb) {
    indexDriver(input.index, input.clientId, fromDb);
    return { driverId: fromDb.id, driverFullName: fromDb.fullName, created: false, source: 'db' };
  }

  if (!input.createIfMissing) {
    return { driverId: null, driverFullName: name, created: false, source: 'missing' };
  }

  const created = await input.drivers.create(
    input.tenantSlug,
    { clientId: input.clientId, fullName: name },
    input.actorUserId,
    input.access,
  );
  indexDriver(input.index, input.clientId, { id: created.id, fullName: created.fullName });
  return { driverId: created.id, driverFullName: created.fullName, created: true, source: 'created' };
}
