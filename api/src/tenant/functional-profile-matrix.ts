import { FunctionalProfile } from '@prisma/client';
import {
  ALL_FUNCTIONAL_CAPABILITIES,
  DEFAULT_FUNCTIONAL_PROFILE_MATRIX,
  type FunctionalCapability,
  type FunctionalProfileMatrixEffective,
} from '../iam/functional-profile';

export type FunctionalProfileMatrixOverride = Partial<
  Record<FunctionalProfile, Partial<Record<FunctionalCapability, boolean>>>
>;

export type FunctionalProfileMatrixResponse = {
  version: 1;
  defaults: FunctionalProfileMatrixEffective;
  effective: FunctionalProfileMatrixEffective;
  override: FunctionalProfileMatrixOverride | null;
  isDefault: boolean;
  updatedAt: string | null;
};

export function parseFunctionalProfileMatrixOverride(raw: unknown): FunctionalProfileMatrixOverride | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('functionalProfileMatrix must be an object');
  }
  const out: FunctionalProfileMatrixOverride = {};
  for (const profile of Object.keys(raw) as FunctionalProfile[]) {
    if (profile !== 'F' && profile !== 'T' && profile !== 'G' && profile !== 'full') continue;
    const row = (raw as Record<string, unknown>)[profile];
    if (row == null) continue;
    if (typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Invalid matrix row for profile ${profile}`);
    }
    const caps: Partial<Record<FunctionalCapability, boolean>> = {};
    for (const cap of ALL_FUNCTIONAL_CAPABILITIES) {
      const v = (row as Record<string, unknown>)[cap];
      if (typeof v === 'boolean') caps[cap] = v;
    }
    if (Object.keys(caps).length > 0) out[profile] = caps;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function mergeFunctionalProfileMatrix(
  override: FunctionalProfileMatrixOverride | null,
): FunctionalProfileMatrixEffective {
  const base = structuredClone(DEFAULT_FUNCTIONAL_PROFILE_MATRIX);
  if (!override) return base;
  for (const profile of Object.keys(override) as FunctionalProfile[]) {
    const row = override[profile];
    if (!row) continue;
    for (const cap of ALL_FUNCTIONAL_CAPABILITIES) {
      if (typeof row[cap] === 'boolean') {
        base[profile][cap] = row[cap]!;
      }
    }
  }
  return base;
}

export function parseStoredFunctionalProfileMatrix(raw: unknown): FunctionalProfileMatrixOverride | null {
  if (raw == null) return null;
  try {
    return parseFunctionalProfileMatrixOverride(raw);
  } catch {
    return null;
  }
}

export function buildFunctionalProfileMatrixResponse(
  stored: unknown,
  updatedAt: Date | null,
): FunctionalProfileMatrixResponse {
  const override = parseStoredFunctionalProfileMatrix(stored);
  const isDefault = override == null;
  return {
    version: 1,
    defaults: DEFAULT_FUNCTIONAL_PROFILE_MATRIX,
    effective: mergeFunctionalProfileMatrix(override),
    override,
    isDefault,
    updatedAt: isDefault ? null : updatedAt?.toISOString() ?? null,
  };
}
