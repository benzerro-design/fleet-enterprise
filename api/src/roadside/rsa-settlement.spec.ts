import { RsaEntitlementStatus, RoadsideInterventionKind } from '@prisma/client';
import { computeRsaSettlement } from './rsa-settlement';

const rate = {
  baseCalloutOutPlanCents: 15000,
  towHookOutPlanCents: 10000,
  towPerKmOutPlanCents: 500,
  winchSurchargeCents: 8000,
  nightWeekendMultiplierPct: 25,
};

const plan = { includedTowKm: 100, overagePerKmCents: 250 };

describe('computeRsaSettlement', () => {
  it('covered tow within included km → 0', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.covered,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 80,
      rateCard: rate,
      plan,
    });
    expect(r.mode).toBe('covered_zero');
    expect(r.amountCents).toBe(0);
    expect(r.billableKm).toBe(0);
  });

  it('covered tow over included km → overage only', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.covered,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 120,
      rateCard: rate,
      plan,
    });
    expect(r.mode).toBe('covered_overage');
    expect(r.billableKm).toBe(20);
    expect(r.amountCents).toBe(20 * 250);
  });

  it('covered without plan bits → rate card (not silent 0)', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.covered,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 40,
      rateCard: rate,
      plan: null,
    });
    expect(r.mode).toBe('rate_card');
    expect(r.amountCents).toBe(15000 + 10000 + 40 * 500);
  });

  it('partial with plan → overage (not full rate card)', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.partial,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 120,
      rateCard: rate,
      plan,
    });
    expect(r.mode).toBe('partial_overage');
    expect(r.billableKm).toBe(20);
    expect(r.amountCents).toBe(20 * 250);
  });

  it('pay_per_use uses full rate card', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.pay_per_use,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 40,
      rateCard: rate,
      plan: null,
    });
    expect(r.mode).toBe('rate_card');
    expect(r.amountCents).toBe(45000);
  });

  it('out_of_plan uses rate card', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.out_of_plan,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 5,
      rateCard: rate,
      plan,
    });
    expect(r.mode).toBe('rate_card');
    expect(r.amountCents).toBe(15000 + 10000 + 5 * 500);
  });

  it('covered non-tow → 0', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.covered,
      kind: RoadsideInterventionKind.jump_start,
      distanceKm: 0,
      rateCard: rate,
      plan,
    });
    expect(r.amountCents).toBe(0);
    expect(r.mode).toBe('covered_zero');
  });

  it('night/weekend multiplier on rate card', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.pay_per_use,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 0,
      rateCard: rate,
      plan: null,
      applyNightWeekend: true,
    });
    const base = 15000 + 10000;
    expect(r.amountCents).toBe(base + Math.round((base * 25) / 100));
  });

  it('night/weekend applies on covered overage', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.covered,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 120,
      rateCard: rate,
      plan,
      applyNightWeekend: true,
    });
    const overage = 20 * 250;
    expect(r.amountCents).toBe(overage + Math.round((overage * 25) / 100));
  });

  it('winch surcharge on rate card', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.pay_per_use,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 0,
      rateCard: rate,
      plan: null,
      applyWinch: true,
    });
    expect(r.amountCents).toBe(15000 + 10000 + 8000);
  });

  it('winch surcharge on covered overage', () => {
    const r = computeRsaSettlement({
      entitlementStatus: RsaEntitlementStatus.covered,
      kind: RoadsideInterventionKind.tow,
      distanceKm: 120,
      rateCard: rate,
      plan,
      applyWinch: true,
    });
    expect(r.amountCents).toBe(20 * 250 + 8000);
  });

  it('rejects negative distanceKm', () => {
    expect(() =>
      computeRsaSettlement({
        entitlementStatus: RsaEntitlementStatus.pay_per_use,
        kind: RoadsideInterventionKind.tow,
        distanceKm: -1,
        rateCard: rate,
        plan: null,
      }),
    ).toThrow(/distanceKm/);
  });
});
