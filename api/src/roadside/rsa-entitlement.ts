import {
  Prisma,
  RsaEnrollmentStatus,
  RsaEntitlementStatus,
  RoadsideInterventionKind,
} from '@prisma/client';

export type RsaEntitlementResult = {
  status: RsaEntitlementStatus;
  enrollmentId: string | null;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  supplierId: string | null;
  featureIncluded: boolean;
  interventionsUsedCount: number | null;
  maxInterventionsPerYear: number | null;
  includedTowKm: number | null;
  overagePerKmCents: number | null;
  note: string;
};

type EnrollmentWithPlan = Prisma.RsaVehicleEnrollmentGetPayload<{
  include: {
    plan: {
      select: {
        id: true;
        code: true;
        name: true;
        featuresJson: true;
        maxInterventionsPerYear: true;
        includedTowKm: true;
        overagePerKmCents: true;
        active: true;
      };
    };
  };
}>;

function featureIncluded(
  featuresJson: Prisma.JsonValue,
  kind: RoadsideInterventionKind,
): boolean {
  if (!featuresJson || typeof featuresJson !== 'object' || Array.isArray(featuresJson)) {
    return false;
  }
  const v = (featuresJson as Record<string, unknown>)[kind];
  return v === true;
}

function dateOnlyUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Alege înrolarea activă: preferă supplierId dacă e dat. */
export function pickActiveEnrollment(
  rows: EnrollmentWithPlan[],
  supplierId?: string | null,
): EnrollmentWithPlan | null {
  const today = dateOnlyUtc();
  const valid = rows.filter((e) => {
    if (e.status !== RsaEnrollmentStatus.active) return false;
    if (!e.plan.active) return false;
    if (e.validFrom > today) return false;
    if (e.validUntil && e.validUntil < today) return false;
    return true;
  });
  if (valid.length === 0) return null;
  if (supplierId?.trim()) {
    const match = valid.find((e) => e.supplierId === supplierId.trim());
    if (match) return match;
  }
  return valid[0] ?? null;
}

/** Statusuri care consumă din plafonul anual (nu draft / cancelled). */
export function countsTowardYearlyCap(
  status: string,
  entitlementStatus: RsaEntitlementStatus | string | null | undefined,
): boolean {
  if (status === 'draft' || status === 'cancelled') return false;
  return (
    entitlementStatus === RsaEntitlementStatus.covered ||
    entitlementStatus === RsaEntitlementStatus.partial ||
    entitlementStatus === 'covered' ||
    entitlementStatus === 'partial'
  );
}

export function utcYearBounds(d = new Date()): { from: Date; to: Date } {
  const y = d.getUTCFullYear();
  return {
    from: new Date(Date.UTC(y, 0, 1)),
    to: new Date(Date.UTC(y + 1, 0, 1)),
  };
}

export function resolveEntitlementFromEnrollment(
  kind: RoadsideInterventionKind,
  enrollment: EnrollmentWithPlan | null,
  /** Override — ex. număr intervenții pe anul calendaristic curent (UTC). */
  usedThisYear?: number | null,
): RsaEntitlementResult {
  if (!enrollment) {
    return {
      status: RsaEntitlementStatus.pay_per_use,
      enrollmentId: null,
      planId: null,
      planCode: null,
      planName: null,
      supplierId: null,
      featureIncluded: false,
      interventionsUsedCount: null,
      maxInterventionsPerYear: null,
      includedTowKm: null,
      overagePerKmCents: null,
      note: 'Fără înrolare activă — pay-per-use / rate card furnizor.',
    };
  }

  const included = featureIncluded(enrollment.plan.featuresJson, kind);
  const used =
    usedThisYear != null ? usedThisYear : enrollment.interventionsUsedCount;
  const max = enrollment.plan.maxInterventionsPerYear;
  const base = {
    enrollmentId: enrollment.id,
    planId: enrollment.plan.id,
    planCode: enrollment.plan.code,
    planName: enrollment.plan.name,
    supplierId: enrollment.supplierId,
    featureIncluded: included,
    interventionsUsedCount: used,
    maxInterventionsPerYear: max,
    includedTowKm: enrollment.plan.includedTowKm,
    overagePerKmCents: enrollment.plan.overagePerKmCents,
  };

  if (!included) {
    return {
      ...base,
      status: RsaEntitlementStatus.out_of_plan,
      note: `Plan ${enrollment.plan.code}: ${kind} nu e inclus — out-of-plan / rate card.`,
    };
  }

  if (max != null && used >= max) {
    return {
      ...base,
      status: RsaEntitlementStatus.partial,
      note: `Plan ${enrollment.plan.code}: plafon ${max} intervenții/an atins (${used}) — acoperire parțială / overage.`,
    };
  }

  if (kind === RoadsideInterventionKind.tow && enrollment.plan.includedTowKm > 0) {
    return {
      ...base,
      status: RsaEntitlementStatus.covered,
      note: `Plan ${enrollment.plan.code}: tractare acoperită (până la ${enrollment.plan.includedTowKm} km incluși).`,
    };
  }

  return {
    ...base,
    status: RsaEntitlementStatus.covered,
    note: `Plan ${enrollment.plan.code}: ${kind} acoperit de abonament.`,
  };
}

export const entitlementEnrollmentInclude = {
  plan: {
    select: {
      id: true,
      code: true,
      name: true,
      featuresJson: true,
      maxInterventionsPerYear: true,
      includedTowKm: true,
      overagePerKmCents: true,
      active: true,
    },
  },
} as const;
