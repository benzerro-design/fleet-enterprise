import { TireCustodySignerRole } from '@prisma/client';
import { assertTireCustodyFinalizeRoles } from './tire-custody-finalize';

describe('assertTireCustodyFinalizeRoles', () => {
  it('requires partner + customer', () => {
    expect(
      assertTireCustodyFinalizeRoles([
        TireCustodySignerRole.partner,
        TireCustodySignerRole.customer,
      ]).ok,
    ).toBe(true);
  });

  it('allows partner + driver', () => {
    expect(
      assertTireCustodyFinalizeRoles([
        TireCustodySignerRole.partner,
        TireCustodySignerRole.driver,
      ]).ok,
    ).toBe(true);
  });

  it('rejects partner alone', () => {
    const r = assertTireCustodyFinalizeRoles([TireCustodySignerRole.partner]);
    expect(r.ok).toBe(false);
  });

  it('rejects customer + driver without partner', () => {
    const r = assertTireCustodyFinalizeRoles([
      TireCustodySignerRole.customer,
      TireCustodySignerRole.driver,
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Partner/i);
  });

  it('rejects partner + witness without customer/driver', () => {
    const r = assertTireCustodyFinalizeRoles([
      TireCustodySignerRole.partner,
      TireCustodySignerRole.witness,
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Customer or driver/i);
  });
});
