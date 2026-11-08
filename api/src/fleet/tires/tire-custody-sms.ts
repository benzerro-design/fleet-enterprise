/**
 * Optional SMS delivery for driver OTP.
 * Configure TIRE_CUSTODY_SMS_WEBHOOK_URL = HTTPS endpoint that accepts JSON:
 *   { to, otp, url, expiresAt, plate?, protocolId? }
 * No Twilio SDK in-repo — webhook keeps the provider pluggable.
 */

export type TireCustodySmsPayload = {
  to: string;
  otp: string;
  url: string;
  expiresAt: string;
  plate?: string | null;
  protocolId?: string;
};

export function isTireCustodySmsConfigured(): boolean {
  const u = process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL?.trim();
  return Boolean(u && /^https?:\/\//i.test(u));
}

export async function sendTireCustodySmsOtp(
  payload: TireCustodySmsPayload,
): Promise<{ sent: true } | { sent: false; error: string }> {
  const webhook = process.env.TIRE_CUSTODY_SMS_WEBHOOK_URL?.trim();
  if (!webhook || !/^https?:\/\//i.test(webhook)) {
    return { sent: false, error: 'SMS webhook not configured (TIRE_CUSTODY_SMS_WEBHOOK_URL)' };
  }
  const to = payload.to.replace(/[^\d+]/g, '');
  if (to.length < 8) {
    return { sent: false, error: 'Invalid phone number' };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.TIRE_CUSTODY_SMS_WEBHOOK_TOKEN?.trim()
          ? { Authorization: `Bearer ${process.env.TIRE_CUSTODY_SMS_WEBHOOK_TOKEN.trim()}` }
          : {}),
      },
      body: JSON.stringify({ ...payload, to }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { sent: false, error: `SMS webhook HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'SMS webhook failed' };
  }
}
