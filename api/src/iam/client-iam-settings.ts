import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccessContext } from './access-context.types';
import { canWriteClientFleet } from './client-access';

export type ClientIamSettings = {
  /** L1 poate rula OCR CIV pe vehiculele clientului. */
  allowClientOcr: boolean;
  /** L1 vede / editează tab Date achiziție. */
  allowClientAcquisition: boolean;
  /** Politică stocată pentru CRM-019 — nu schimbă încă gate-ul WO. */
  requireDriverAck: boolean;
};

export const DEFAULT_CLIENT_IAM_SETTINGS: ClientIamSettings = {
  allowClientOcr: false,
  allowClientAcquisition: false,
  requireDriverAck: true,
};

export function parseClientIamSettings(raw: unknown): ClientIamSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CLIENT_IAM_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    allowClientOcr: o.allowClientOcr === true,
    allowClientAcquisition: o.allowClientAcquisition === true,
    requireDriverAck: o.requireDriverAck !== false,
  };
}

export function parseClientIamSettingsPatch(body: unknown): Partial<ClientIamSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<ClientIamSettings> = {};
  if (o.allowClientOcr !== undefined) {
    if (typeof o.allowClientOcr !== 'boolean') throw new Error('allowClientOcr must be boolean');
    patch.allowClientOcr = o.allowClientOcr;
  }
  if (o.allowClientAcquisition !== undefined) {
    if (typeof o.allowClientAcquisition !== 'boolean') {
      throw new Error('allowClientAcquisition must be boolean');
    }
    patch.allowClientAcquisition = o.allowClientAcquisition;
  }
  if (o.requireDriverAck !== undefined) {
    if (typeof o.requireDriverAck !== 'boolean') throw new Error('requireDriverAck must be boolean');
    patch.requireDriverAck = o.requireDriverAck;
  }
  return patch;
}

export async function assertClientIamFeature(
  prisma: PrismaService,
  tenantSlug: string,
  vehicleId: string,
  access: AccessContext | undefined,
  feature: 'allowClientOcr' | 'allowClientAcquisition',
): Promise<void> {
  if (!access || access.membershipRole === MembershipRole.tenant_admin) return;
  if (!canWriteClientFleet(access)) {
    throw new ForbiddenException('Cannot use this client feature');
  }
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenant: { slug: tenantSlug } },
    select: { clientId: true, tenantId: true },
  });
  if (!vehicle) throw new NotFoundException('Vehicle not found');
  if (!access.allowedClientIds.includes(vehicle.clientId)) {
    throw new ForbiddenException('Vehicle is outside your client scope');
  }
  let settings = { ...DEFAULT_CLIENT_IAM_SETTINGS };
  try {
    const client = await prisma.client.findFirst({
      where: { id: vehicle.clientId, tenantId: vehicle.tenantId },
      select: { iamSettings: true },
    });
    settings = parseClientIamSettings(client?.iamSettings);
  } catch {
    /* column missing — treat as defaults */
  }
  if (!settings[feature]) {
    throw new ForbiddenException(
      feature === 'allowClientOcr'
        ? 'OCR CIV nu e activat pentru acest client'
        : 'Datele de achiziție nu sunt activate pentru acest client',
    );
  }
}
