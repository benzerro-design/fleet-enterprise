export const MOBILITY_ELIGIBILITY_HOURS = 72;

export function computeImmobilizationHours(
  inServiceAt: Date | string | null | undefined,
  estimatedRepairAt: Date | string | null | undefined,
  outServiceAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!inServiceAt) return null;
  const start = new Date(inServiceAt);
  if (Number.isNaN(start.getTime())) return null;
  const endRaw = outServiceAt ?? estimatedRepairAt ?? now;
  const end = new Date(endRaw);
  if (Number.isNaN(end.getTime())) return null;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, Math.round(hours * 10) / 10);
}

export function isMobilityEligible(
  inServiceAt: Date | string | null | undefined,
  estimatedRepairAt: Date | string | null | undefined,
  outServiceAt: Date | string | null | undefined,
  now?: Date,
): boolean {
  const hours = computeImmobilizationHours(inServiceAt, estimatedRepairAt, outServiceAt, now);
  return hours !== null && hours > MOBILITY_ELIGIBILITY_HOURS;
}
