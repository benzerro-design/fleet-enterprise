import {
  hashTireCustodySecret,
  mintDriverInviteSecrets,
  verifyDriverInvite,
} from './tire-custody-invite';

describe('tire-custody-invite', () => {
  it('mints token+otp with hashes', () => {
    const m = mintDriverInviteSecrets(new Date('2026-11-07T12:00:00Z'));
    expect(m.token.length).toBeGreaterThan(20);
    expect(m.otp).toMatch(/^\d{6}$/);
    expect(m.tokenHash).toBe(hashTireCustodySecret(m.token));
    expect(m.otpHash).toBe(hashTireCustodySecret(m.otp));
    expect(m.expiresAt.getTime()).toBeGreaterThan(Date.parse('2026-11-07T12:00:00Z'));
  });

  it('verifies matching token+otp', () => {
    const m = mintDriverInviteSecrets();
    expect(
      verifyDriverInvite({
        token: m.token,
        otp: m.otp,
        tokenHash: m.tokenHash,
        otpHash: m.otpHash,
        expiresAt: m.expiresAt,
      }).ok,
    ).toBe(true);
  });

  it('rejects wrong otp', () => {
    const m = mintDriverInviteSecrets();
    const r = verifyDriverInvite({
      token: m.token,
      otp: '000000',
      tokenHash: m.tokenHash,
      otpHash: m.otpHash,
      expiresAt: m.expiresAt,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects expired invite', () => {
    const m = mintDriverInviteSecrets(new Date('2020-01-01T00:00:00Z'));
    const r = verifyDriverInvite({
      token: m.token,
      otp: m.otp,
      tokenHash: m.tokenHash,
      otpHash: m.otpHash,
      expiresAt: m.expiresAt,
      now: new Date('2026-11-07T12:00:00Z'),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/expired/i);
  });
});
