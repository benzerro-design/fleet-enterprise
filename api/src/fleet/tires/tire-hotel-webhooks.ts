import { createHmac } from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('TireHotelWebhooks');

export type TireStayWebhookEvent = 'tire.stay.checked_in' | 'tire.stay.checked_out';

export type TireStayWebhookPayload = {
  event: TireStayWebhookEvent;
  tenantId: string;
  stayId: string;
  setId: string;
  supplierId: string;
  vehicleId: string | null;
  at: string;
  feeCents?: number | null;
  releaseKind?: string | null;
  costEntryId?: string | null;
};

export type TireStayWebhookDeliveryOpts = {
  /** Tenant product config URL (used when env override absent). */
  webhookUrl?: string | null;
  /** Tenant HMAC secret. */
  webhookSecret?: string | null;
};

/**
 * Outbound stay hook.
 * WEBHOOK_TIRE_URL env overrides tenant webhookUrl when set.
 */
export async function emitTireStayWebhook(
  payload: TireStayWebhookPayload,
  opts?: TireStayWebhookDeliveryOpts,
): Promise<void> {
  const envUrl = process.env.WEBHOOK_TIRE_URL?.trim();
  const url = envUrl || opts?.webhookUrl?.trim() || '';
  if (!url) {
    logger.debug(`${payload.event} stay=${payload.stayId}`);
    return;
  }
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = opts?.webhookSecret?.trim();
  if (secret) {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Tire-Signature'] = `sha256=${sig}`;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      logger.warn(`tire webhook ${res.status} for ${payload.event} stay=${payload.stayId}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`tire webhook failed: ${msg}`);
  }
}
