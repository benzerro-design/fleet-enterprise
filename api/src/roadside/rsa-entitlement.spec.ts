import { RsaEnrollmentStatus, RsaEntitlementStatus, RoadsideInterventionKind } from '@prisma/client';
import {
  pickActiveEnrollment,
  resolveEntitlementFromEnrollment,
} from './rsa-entitlement';

function enrollment(overrides: Record<string, unknown> = {}) {
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
  return {
    id: 'enr1',
    tenantId: 't1',
    clientId: 'c1',
    vehicleId: 'v1',
    planId: 'p1',
    supplierId: 's1',
    status: RsaEnrollmentStatus.active,
    externalSubscriptionNo: null,
    validFrom: from,
    validUntil: null,
    interventionsUsedCount: 0,
    notes: null,
    createdAt: today,
    updatedAt: today,
    plan: {
      id: 'p1',
      code: 'RSA-BASIC',
      name: 'Basic',
      featuresJson: {
        tow: true,
        jump_start: true,
        tire_change: false,
        lockout: true,
        fuel_delivery: true,
        other: false,
      },
      maxInterventionsPerYear: 5,
      includedTowKm: 100,
      overagePerKmCents: 250,
      active: true,
    },
    ...overrides,
  } as Parameters<typeof pickActiveEnrollment>[0][number];
}

describe('rsa-entitlement', () => {
  it('pay_per_use without enrollment', () => {
    const r = resolveEntitlementFromEnrollment(RoadsideInterventionKind.tow, null);
    expect(r.status).toBe(RsaEntitlementStatus.pay_per_use);
  });

  it('covered when feature included under cap', () => {
    const r = resolveEntitlementFromEnrollment(RoadsideInterventionKind.tow, enrollment());
    expect(r.status).toBe(RsaEntitlementStatus.covered);
    expect(r.planCode).toBe('RSA-BASIC');
  });

  it('out_of_plan when feature missing', () => {
    const r = resolveEntitlementFromEnrollment(
      RoadsideInterventionKind.tire_change,
      enrollment(),
    );
    expect(r.status).toBe(RsaEntitlementStatus.out_of_plan);
  });

  it('partial when yearly cap reached', () => {
    const r = resolveEntitlementFromEnrollment(
      RoadsideInterventionKind.tow,
      enrollment({ interventionsUsedCount: 5 }),
    );
    expect(r.status).toBe(RsaEntitlementStatus.partial);
  });

  it('uses usedThisYear override over enrollment counter', () => {
    const r = resolveEntitlementFromEnrollment(
      RoadsideInterventionKind.tow,
      enrollment({ interventionsUsedCount: 0 }),
      5,
    );
    expect(r.status).toBe(RsaEntitlementStatus.partial);
    expect(r.interventionsUsedCount).toBe(5);
  });

  it('prefers supplier-matching enrollment', () => {
    const a = enrollment({ id: 'a', supplierId: 'sA' });
    const b = enrollment({ id: 'b', supplierId: 'sB' });
    expect(pickActiveEnrollment([a, b], 'sB')?.id).toBe('b');
    expect(pickActiveEnrollment([a, b], null)?.id).toBe('a');
  });
});
