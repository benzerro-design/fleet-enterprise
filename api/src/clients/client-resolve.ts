import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** CUID-ish ids from Prisma; also accept seeded `cl_` prefixes. */
export function looksLikeClientRef(input: string): boolean {
  const t = input.trim();
  return t.length >= 20 && /^[a-z0-9_]+$/i.test(t);
}

export type ResolvedClient = {
  id: string;
  code: string;
  legalName: string;
};

/**
 * Resolve client by id or case-insensitive code within tenant.
 * Used for API bodies/filters that still send `clientId` as code (backward compatible).
 */
export async function resolveClientInTenant(
  prisma: PrismaService,
  tenantUuid: string,
  input: string,
): Promise<ResolvedClient> {
  const raw = input.trim();
  if (!raw) {
    throw new NotFoundException('Client not found');
  }

  if (looksLikeClientRef(raw)) {
    const byId = await prisma.client.findFirst({
      where: { id: raw, tenantId: tenantUuid },
      select: { id: true, code: true, legalName: true },
    });
    if (byId) return byId;
  }

  const byCode = await prisma.client.findFirst({
    where: {
      tenantId: tenantUuid,
      code: { equals: raw, mode: 'insensitive' },
    },
    select: { id: true, code: true, legalName: true },
  });
  if (!byCode) {
    throw new NotFoundException(`Client not found: ${raw}`);
  }
  return byCode;
}

/** Optional filter — returns vehicle.clientId FK or undefined if input empty. */
export async function resolveOptionalClientVehicleFilter(
  prisma: PrismaService,
  tenantUuid: string,
  clientInput: string | undefined,
): Promise<Prisma.VehicleWhereInput | null> {
  const raw = clientInput?.trim();
  if (!raw) return null;
  const client = await resolveClientInTenant(prisma, tenantUuid, raw);
  return { clientId: client.id };
}
