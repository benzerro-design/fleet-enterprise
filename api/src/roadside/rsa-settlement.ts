import { RsaEntitlementStatus, RoadsideInterventionKind } from '@prisma/client';

export type RsaSettlementRateCard = {
  baseCalloutOutPlanCents: number;
  towHookOutPlanCents: number;
  towPerKmOutPlanCents: number;
  winchSurchargeCents: number;
  nightWeekendMultiplierPct: number;
};

export type RsaSettlementPlanBits = {
  includedTowKm: number | null;
  overagePerKmCents: number | null;
};

export type RsaSettlementLine = {
  code: string;
  label: string;
  cents: number;
};

export type RsaSettlementBreakdown = {
  amountCents: number;
  billableKm: number;
  includedKmApplied: number;
  mode: 'covered_zero' | 'covered_overage' | 'partial_overage' | 'rate_card';
  entitlementStatus: string;
  kind: string;
  distanceKm: number;
  lines: RsaSettlementLine[];
};

function asNonNegInt(n: number, label: string): number {
  if (!Number.isFinite(n) || n < 0 || Math.round(n) !== n) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return n;
}

function hasPlanBits(plan: RsaSettlementPlanBits | null | undefined): boolean {
  if (!plan) return false;
  return plan.includedTowKm != null || plan.overagePerKmCents != null;
}

function applyNightWeekend(
  subtotal: number,
  lines: RsaSettlementLine[],
  rate: RsaSettlementRateCard,
  apply: boolean | undefined,
): { amountCents: number; lines: RsaSettlementLine[] } {
  const outLines = [...lines];
  let amountCents = subtotal;
  const multPct = Math.max(0, Math.round(rate.nightWeekendMultiplierPct));
  if (apply && multPct > 0 && subtotal > 0) {
    const surcharge = Math.round((subtotal * multPct) / 100);
    outLines.push({
      code: 'night_weekend',
      label: `Noapte/weekend +${multPct}%`,
      cents: surcharge,
    });
    amountCents = subtotal + surcharge;
  }
  return { amountCents, lines: outLines };
}

function rateCardSubtotal(
  kind: string,
  distanceKm: number,
  rate: RsaSettlementRateCard,
  opts: { applyWinch?: boolean },
): { cents: number; lines: RsaSettlementLine[] } {
  const lines: RsaSettlementLine[] = [];
  const callout = Math.max(0, Math.round(rate.baseCalloutOutPlanCents));
  if (callout > 0) {
    lines.push({ code: 'callout', label: 'Deplasare / callout', cents: callout });
  }

  const isTow = kind === RoadsideInterventionKind.tow || kind === 'tow';
  if (isTow) {
    const hook = Math.max(0, Math.round(rate.towHookOutPlanCents));
    if (hook > 0) {
      lines.push({ code: 'tow_hook', label: 'Hook / ridicare', cents: hook });
    }
    const perKm = Math.max(0, Math.round(rate.towPerKmOutPlanCents));
    const kmCents = distanceKm * perKm;
    if (kmCents > 0 || distanceKm > 0) {
      lines.push({
        code: 'tow_km',
        label: `Tractare ${distanceKm} km × ${perKm} bani`,
        cents: kmCents,
      });
    }
  }

  if (opts.applyWinch) {
    const winch = Math.max(0, Math.round(rate.winchSurchargeCents));
    if (winch > 0) {
      lines.push({ code: 'winch', label: 'Supliment troliu', cents: winch });
    }
  }

  return {
    cents: lines.reduce((s, l) => s + l.cents, 0),
    lines,
  };
}

function planOverageSettlement(input: {
  status: string;
  kind: string;
  distanceKm: number;
  plan: RsaSettlementPlanBits;
  rateCard: RsaSettlementRateCard;
  applyNightWeekend?: boolean;
  applyWinch?: boolean;
  mode: 'covered_overage' | 'partial_overage' | 'covered_zero';
}): RsaSettlementBreakdown {
  const { status, kind, distanceKm, plan, rateCard } = input;
  const included = Math.max(0, Math.round(plan.includedTowKm ?? 0));
  const overagePerKm = Math.max(0, Math.round(plan.overagePerKmCents ?? 0));
  const includedApplied = Math.min(distanceKm, included);
  const billableKm = Math.max(0, distanceKm - included);

  if (billableKm === 0 && !input.applyWinch) {
    return {
      amountCents: 0,
      billableKm: 0,
      includedKmApplied: includedApplied,
      mode: 'covered_zero',
      entitlementStatus: status,
      kind,
      distanceKm,
      lines: [
        {
          code: 'covered',
          label: `Acoperit (≤ ${included} km incluși)`,
          cents: 0,
        },
      ],
    };
  }

  const overageCents = billableKm * overagePerKm;
  const lines: RsaSettlementLine[] = [];
  if (includedApplied > 0 || billableKm === 0) {
    lines.push({
      code: 'included_km',
      label: `${includedApplied} km incluși în plan`,
      cents: 0,
    });
  }
  if (billableKm > 0) {
    lines.push({
      code: 'overage_km',
      label: `Overage ${billableKm} km × ${overagePerKm} bani`,
      cents: overageCents,
    });
  }
  let subtotal = overageCents;
  if (input.applyWinch) {
    const winch = Math.max(0, Math.round(rateCard.winchSurchargeCents));
    if (winch > 0) {
      lines.push({ code: 'winch', label: 'Supliment troliu', cents: winch });
      subtotal += winch;
    }
  }
  const withNw = applyNightWeekend(subtotal, lines, rateCard, input.applyNightWeekend);
  return {
    amountCents: withNw.amountCents,
    billableKm,
    includedKmApplied: includedApplied,
    mode:
      billableKm === 0 && !input.applyWinch
        ? 'covered_zero'
        : input.mode === 'partial_overage'
          ? 'partial_overage'
          : 'covered_overage',
    entitlementStatus: status,
    kind,
    distanceKm,
    lines: withNw.lines,
  };
}

/**
 * Calculează suma decontabilă RSA din snapshot entitlement + rate card + km.
 * Pure — fără I/O.
 *
 * - covered / partial + plan bits → km incluși + overage (partial = același model overage)
 * - covered / partial fără plan bits → rate card (nu decontează 0 pe tăcere)
 * - out_of_plan / pay_per_use → rate card
 */
export function computeRsaSettlement(input: {
  entitlementStatus: RsaEntitlementStatus | string;
  kind: RoadsideInterventionKind | string;
  distanceKm: number;
  rateCard: RsaSettlementRateCard;
  plan: RsaSettlementPlanBits | null;
  applyNightWeekend?: boolean;
  applyWinch?: boolean;
}): RsaSettlementBreakdown {
  const distanceKm = asNonNegInt(input.distanceKm, 'distanceKm');
  const status = String(input.entitlementStatus);
  const kind = String(input.kind);
  const isTow = kind === RoadsideInterventionKind.tow || kind === 'tow';

  const covered = status === RsaEntitlementStatus.covered || status === 'covered';
  const partial = status === RsaEntitlementStatus.partial || status === 'partial';
  const planOk = hasPlanBits(input.plan);

  if ((covered || partial) && !isTow) {
    return {
      amountCents: 0,
      billableKm: 0,
      includedKmApplied: 0,
      mode: 'covered_zero',
      entitlementStatus: status,
      kind,
      distanceKm,
      lines: [
        {
          code: 'covered',
          label: covered
            ? 'Acoperit de abonament (non-tow)'
            : 'Parțial / non-tow — fără km decontabili',
          cents: 0,
        },
      ],
    };
  }

  if ((covered || partial) && isTow && planOk && input.plan) {
    return planOverageSettlement({
      status,
      kind,
      distanceKm,
      plan: input.plan,
      rateCard: input.rateCard,
      applyNightWeekend: input.applyNightWeekend,
      applyWinch: input.applyWinch,
      mode: partial ? 'partial_overage' : 'covered_overage',
    });
  }

  // covered/partial fără plan bits, sau out_of_plan / pay_per_use → rate card
  const { cents: subtotal, lines } = rateCardSubtotal(kind, distanceKm, input.rateCard, {
    applyWinch: input.applyWinch,
  });
  const withNw = applyNightWeekend(subtotal, lines, input.rateCard, input.applyNightWeekend);
  const outLines =
    withNw.lines.length > 0
      ? withNw.lines
      : [
          {
            code: 'rate_card_empty',
            label: 'Rate card zero — decont 0',
            cents: 0,
          },
        ];

  return {
    amountCents: withNw.amountCents,
    billableKm: isTow ? distanceKm : 0,
    includedKmApplied: 0,
    mode: 'rate_card',
    entitlementStatus: status,
    kind,
    distanceKm,
    lines: outLines,
  };
}

export const RSA_COST_CATEGORY = 'Asistență rutieră';

export function parseRateCardSnapshot(
  value: unknown,
): RsaSettlementRateCard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const num = (k: string) =>
    typeof o[k] === 'number' && Number.isFinite(o[k] as number) ? Math.round(o[k] as number) : 0;
  return {
    baseCalloutOutPlanCents: num('baseCalloutOutPlanCents'),
    towHookOutPlanCents: num('towHookOutPlanCents'),
    towPerKmOutPlanCents: num('towPerKmOutPlanCents'),
    winchSurchargeCents: num('winchSurchargeCents'),
    nightWeekendMultiplierPct: num('nightWeekendMultiplierPct'),
  };
}
