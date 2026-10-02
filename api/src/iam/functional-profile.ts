import { ClientRole, FunctionalProfile, MembershipRole } from '@prisma/client';
import type { AccessContext, ClientMembershipContext } from './access-context.types';

export type FunctionalCapability =
  | 'quote.edit'
  | 'quote.approve'
  | 'quote.postCost'
  | 'scheduler.write'
  | 'fleet.write';

/** Default IAM-003: F = financiar, T = tehnic, G = gestiune, full = tot. */
const PROFILE_CAPS: Record<FunctionalProfile, ReadonlySet<FunctionalCapability>> = {
  F: new Set(['quote.approve', 'quote.postCost']),
  T: new Set(['quote.edit', 'fleet.write']),
  G: new Set(['scheduler.write', 'fleet.write']),
  full: new Set(['quote.edit', 'quote.approve', 'quote.postCost', 'scheduler.write', 'fleet.write']),
};

export function parseFunctionalProfile(raw: unknown): FunctionalProfile | null {
  if (raw === 'F' || raw === 'T' || raw === 'G' || raw === 'full') return raw;
  return null;
}

function membershipForClient(
  ctx: AccessContext,
  clientId: string,
): ClientMembershipContext | undefined {
  return ctx.clientMemberships.find((m) => m.clientId === clientId);
}

/**
 * Profil efectiv: pe L* din TenantMembership; pe L1 din ClientMembership.
 * null = comportament legacy (fără restricție F/T/G).
 */
export function effectiveFunctionalProfile(
  ctx: AccessContext,
  clientId?: string,
): FunctionalProfile | null {
  if (ctx.membershipRole === MembershipRole.tenant_admin) {
    return ctx.tenantFunctionalProfile ?? null;
  }
  if (ctx.membershipRole === MembershipRole.tenant_viewer) {
    return ctx.tenantFunctionalProfile ?? null;
  }
  if (clientId) {
    return membershipForClient(ctx, clientId)?.functionalProfile ?? null;
  }
  const profiles = ctx.clientMemberships
    .map((m) => m.functionalProfile)
    .filter((p): p is FunctionalProfile => p != null);
  if (profiles.length === 0) return null;
  if (profiles.includes(FunctionalProfile.full)) return FunctionalProfile.full;
  if (profiles.includes(FunctionalProfile.F)) return FunctionalProfile.F;
  return profiles[0] ?? null;
}

export function profileAllows(
  profile: FunctionalProfile | null,
  cap: FunctionalCapability,
): boolean {
  if (profile == null) return true; // legacy = fără restricție pe axa F/T/G
  return PROFILE_CAPS[profile].has(cap);
}

export function accessAllowsCapability(
  ctx: AccessContext,
  cap: FunctionalCapability,
  clientId?: string,
): boolean {
  return profileAllows(effectiveFunctionalProfile(ctx, clientId), cap);
}
