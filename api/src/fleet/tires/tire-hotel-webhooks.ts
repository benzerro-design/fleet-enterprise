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

/** Optional outbound hook when WEBHOOK_TIRE_URL is set; otherwise logs only. */
export async function emitTireStayWebhook(payload: TireStayWebhookPayload): Promise<void> {
  const url = process.env.WEBHOOK_TIRE_URL?.trim();
  if (!url) {
    logger.debug(`${payload.event} stay=${payload.stayId}`);
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn(`WEBHOOK_TIRE_URL ${res.status} for ${payload.event} stay=${payload.stayId}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`WEBHOOK_TIRE_URL failed: ${msg}`);
  }
}
