/** Simple in-memory sliding window for public driver OTP attempts. */

export type OtpRateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number; message: string };

export class TireCustodyOtpRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxAttempts: number = 8,
    private readonly windowMs: number = 15 * 60 * 1000,
  ) {}

  check(key: string, now = Date.now()): OtpRateLimitResult {
    const cutoff = now - this.windowMs;
    const prev = (this.hits.get(key) ?? []).filter((t) => t >= cutoff);
    if (prev.length >= this.maxAttempts) {
      const oldest = prev[0]!;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return {
        ok: false,
        retryAfterSec,
        message: `Too many OTP attempts. Retry in ${retryAfterSec}s`,
      };
    }
    prev.push(now);
    this.hits.set(key, prev);
    return { ok: true, remaining: this.maxAttempts - prev.length };
  }

  /** Test helper. */
  reset(): void {
    this.hits.clear();
  }
}

export const tireCustodyOtpRateLimiter = new TireCustodyOtpRateLimiter();
