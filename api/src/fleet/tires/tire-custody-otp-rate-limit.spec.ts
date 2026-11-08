import { TireCustodyOtpRateLimiter } from './tire-custody-otp-rate-limit';

describe('TireCustodyOtpRateLimiter', () => {
  it('allows under max then blocks with retryAfterSec', () => {
    const lim = new TireCustodyOtpRateLimiter(3, 60_000);
    const t0 = 1_000_000;
    expect(lim.check('a', t0).ok).toBe(true);
    expect(lim.check('a', t0 + 1).ok).toBe(true);
    expect(lim.check('a', t0 + 2).ok).toBe(true);
    const blocked = lim.check('a', t0 + 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
      expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
      expect(blocked.message).toMatch(/Retry in \d+s/);
    }
  });

  it('isolates keys', () => {
    const lim = new TireCustodyOtpRateLimiter(1, 60_000);
    expect(lim.check('x', 1).ok).toBe(true);
    expect(lim.check('x', 2).ok).toBe(false);
    expect(lim.check('y', 2).ok).toBe(true);
  });

  it('slides window', () => {
    const lim = new TireCustodyOtpRateLimiter(1, 1000);
    expect(lim.check('z', 1000).ok).toBe(true);
    expect(lim.check('z', 1001).ok).toBe(false);
    expect(lim.check('z', 2001).ok).toBe(true);
  });
});
