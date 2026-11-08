import { createHash, randomBytes, randomInt } from 'crypto';
import { timingSafeEqual } from 'crypto';

export const DRIVER_INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export function hashTireCustodySecret(raw: string): string {
  return createHash('sha256').update(raw.trim(), 'utf8').digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function mintDriverInviteSecrets(now = new Date()): {
  token: string;
  otp: string;
  tokenHash: string;
  otpHash: string;
  expiresAt: Date;
} {
  const token = randomBytes(24).toString('base64url');
  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(now.getTime() + DRIVER_INVITE_TTL_MS);
  return {
    token,
    otp,
    tokenHash: hashTireCustodySecret(token),
    otpHash: hashTireCustodySecret(otp),
    expiresAt,
  };
}

export function verifyDriverInvite(params: {
  token: string;
  otp: string;
  tokenHash: string | null;
  otpHash: string | null;
  expiresAt: Date | null;
  now?: Date;
}): { ok: true } | { ok: false; message: string } {
  if (!params.tokenHash || !params.otpHash || !params.expiresAt) {
    return { ok: false, message: 'No active driver invite' };
  }
  const now = params.now ?? new Date();
  if (params.expiresAt.getTime() < now.getTime()) {
    return { ok: false, message: 'Driver invite expired' };
  }
  if (!safeEqualHex(hashTireCustodySecret(params.token), params.tokenHash)) {
    return { ok: false, message: 'Invalid invite token' };
  }
  if (!safeEqualHex(hashTireCustodySecret(params.otp), params.otpHash)) {
    return { ok: false, message: 'Invalid OTP' };
  }
  return { ok: true };
}
