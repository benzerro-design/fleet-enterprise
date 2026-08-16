import { Injectable, Logger } from '@nestjs/common';
import type { PartsPriceOffer } from '../work-orders/parts-catalog-lookup';
import {
  defaultInterCarsBaseUrl,
  defaultInterCarsTokenUrl,
  interCarsHasCredentials,
  type InterCarsConnectorSettings,
} from './integrations-settings';

type QuoteLineResult = {
  sku: string;
  index?: string;
  name?: string;
  price?: {
    currencyCode?: string;
    customerPriceNet?: number;
    listPriceNet?: number;
  };
  lines?: Array<{ location?: string; availability?: number }>;
};

@Injectable()
export class InterCarsClient {
  private readonly logger = new Logger(InterCarsClient.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  async testConnection(cfg: InterCarsConnectorSettings): Promise<{ ok: boolean; message: string }> {
    if (!interCarsHasCredentials(cfg)) {
      return {
        ok: false,
        message:
          cfg.mode === 'katalog_legacy'
            ? 'Completează customer code (kh_kod) și token Katalog.'
            : 'Completează access token sau client id + secret (gateway).',
      };
    }
    try {
      if (cfg.mode === 'katalog_legacy') {
        await this.katalogPing(cfg);
        return { ok: true, message: 'Katalog External: autentificare OK' };
      }
      await this.getAccessToken(cfg);
      // Lightweight catalog call — empty sku may 400; use a known-style probe via quote empty → expect 4xx with auth ok
      const probe = await this.gatewayInventoryQuote(cfg, ['TESTSKU0001']);
      if (probe.error && /401|403|unauthor/i.test(probe.error)) {
        return { ok: false, message: `Auth eșuat: ${probe.error}` };
      }
      return {
        ok: true,
        message: probe.error
          ? `Gateway auth OK (probe catalog: ${probe.error.slice(0, 120)})`
          : `Gateway OK — ${probe.offers.length} ofertă(e) pe SKU test`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Eroare necunoscută';
      this.logger.warn(`Inter Cars test failed: ${msg}`);
      return { ok: false, message: msg };
    }
  }

  /**
   * Lookup prețuri pentru coduri (SKU IC sau index OE).
   * Returnează oferte non-stub când API răspunde; altfel [].
   */
  async lookupOffers(
    cfg: InterCarsConnectorSettings,
    partNumbers: string[],
  ): Promise<Map<string, PartsPriceOffer[]>> {
    const out = new Map<string, PartsPriceOffer[]>();
    const codes = [...new Set(partNumbers.map((p) => p.trim()).filter(Boolean))];
    if (!codes.length || !interCarsHasCredentials(cfg)) return out;

    try {
      if (cfg.mode === 'katalog_legacy') {
        // Legacy API nu are quote standard documentat aici — fără oferte reale.
        this.logger.warn('Inter Cars katalog_legacy: price quote not implemented; use gateway mode');
        return out;
      }

      const { offersByCode, error } = await this.gatewayInventoryQuote(cfg, codes);
      if (error) this.logger.warn(`Inter Cars quote: ${error}`);
      for (const [code, offers] of offersByCode) {
        out.set(code, offers);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'lookup failed';
      this.logger.warn(`Inter Cars lookup failed: ${msg}`);
    }
    return out;
  }

  private resolveBase(cfg: InterCarsConnectorSettings): string {
    return (cfg.baseUrl?.replace(/\/$/, '') ||
      defaultInterCarsBaseUrl(cfg.environment, cfg.mode)).replace(/\/$/, '');
  }

  private async getAccessToken(cfg: InterCarsConnectorSettings): Promise<string> {
    if (cfg.accessToken?.trim()) return cfg.accessToken.trim();

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.token;
    }

    const clientId = cfg.clientId?.trim();
    const clientSecret = cfg.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('Lipsă accessToken sau clientId/clientSecret');
    }

    const tokenUrl =
      cfg.tokenUrl?.trim() || defaultInterCarsTokenUrl(cfg.environment);
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Token HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    let json: { access_token?: string; expires_in?: number };
    try {
      json = JSON.parse(text) as { access_token?: string; expires_in?: number };
    } catch {
      throw new Error('Răspuns token invalid (nu e JSON)');
    }
    if (!json.access_token) throw new Error('Token fără access_token');
    const expiresIn = Number(json.expires_in) > 0 ? Number(json.expires_in) : 3600;
    this.tokenCache = {
      token: json.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return json.access_token;
  }

  private async gatewayInventoryQuote(
    cfg: InterCarsConnectorSettings,
    codes: string[],
  ): Promise<{ offersByCode: Map<string, PartsPriceOffer[]>; offers: PartsPriceOffer[]; error?: string }> {
    const offersByCode = new Map<string, PartsPriceOffer[]>();
    const token = await this.getAccessToken(cfg);
    const base = this.resolveBase(cfg);
    const url = `${base}/inventory/1.0.0/inventory/quote`;

    // IC accepts sku query OR body lines — try as SKU list first, then index
    const skuParam = codes.map(encodeURIComponent).join(',');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch(`${url}?sku=${skuParam}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          lines: codes.map((sku) => ({ sku, quantity: 1 })),
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    if (!res.ok) {
      // Retry with index query for OE-style codes
      if (res.status === 400 || res.status === 404) {
        return this.gatewayInventoryQuoteByIndex(cfg, codes, token, base);
      }
      return {
        offersByCode,
        offers: [],
        error: `Quote HTTP ${res.status}: ${text.slice(0, 180)}`,
      };
    }

    let rows: QuoteLineResult[] = [];
    try {
      const parsed = JSON.parse(text) as unknown;
      rows = Array.isArray(parsed) ? (parsed as QuoteLineResult[]) : [];
    } catch {
      return { offersByCode, offers: [], error: 'Quote response nu e JSON array' };
    }

    const allOffers: PartsPriceOffer[] = [];
    for (const row of rows) {
      const offer = this.rowToOffer(row);
      if (!offer) continue;
      const keys = [row.sku, row.index].filter(Boolean) as string[];
      for (const key of keys) {
        const list = offersByCode.get(key) ?? [];
        list.push(offer);
        offersByCode.set(key, list);
        // Also map case-insensitive for caller codes
        offersByCode.set(key.toUpperCase(), list);
      }
      allOffers.push(offer);
    }

    // Map caller codes that matched case-insensitively
    for (const code of codes) {
      if (offersByCode.has(code)) continue;
      const hit =
        offersByCode.get(code.toUpperCase()) ??
        offersByCode.get(code.replace(/\s+/g, '').toUpperCase());
      if (hit) offersByCode.set(code, hit);
    }

    return { offersByCode, offers: allOffers };
  }

  private async gatewayInventoryQuoteByIndex(
    cfg: InterCarsConnectorSettings,
    codes: string[],
    token: string,
    base: string,
  ): Promise<{ offersByCode: Map<string, PartsPriceOffer[]>; offers: PartsPriceOffer[]; error?: string }> {
    const offersByCode = new Map<string, PartsPriceOffer[]>();
    const allOffers: PartsPriceOffer[] = [];
    const url = `${base}/inventory/1.0.0/inventory/quote`;

    for (const code of codes.slice(0, 30)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(`${url}?index=${encodeURIComponent(code)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ lines: [{ index: code, quantity: 1 }] }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      const text = await res.text();
      let rows: QuoteLineResult[] = [];
      try {
        const parsed = JSON.parse(text) as unknown;
        rows = Array.isArray(parsed) ? (parsed as QuoteLineResult[]) : [];
      } catch {
        continue;
      }
      const list: PartsPriceOffer[] = [];
      for (const row of rows) {
        const offer = this.rowToOffer(row);
        if (!offer) continue;
        list.push(offer);
        allOffers.push(offer);
      }
      if (list.length) offersByCode.set(code, list);
    }

    return {
      offersByCode,
      offers: allOffers,
      error: allOffers.length ? undefined : 'Nicio ofertă pe sku/index',
    };
  }

  private rowToOffer(row: QuoteLineResult): PartsPriceOffer | null {
    const net = row.price?.customerPriceNet ?? row.price?.listPriceNet;
    if (net == null || !Number.isFinite(Number(net)) || Number(net) < 0) return null;
    const unitNetCents = Math.round(Number(net) * 100);
    const availQty = row.lines?.reduce((s, l) => s + (Number(l.availability) || 0), 0) ?? 0;
    return {
      providerId: 'intercars',
      providerLabel: 'Inter Cars',
      unitNetCents,
      currency: (row.price?.currencyCode || 'RON').toUpperCase(),
      availability: availQty > 0 ? 'in_stock' : 'order',
      stub: false,
      sku: row.sku || null,
      name: row.name || null,
    };
  }

  private async katalogPing(cfg: InterCarsConnectorSettings): Promise<void> {
    const base = this.resolveBase(cfg);
    // Minimal authenticated call — GetInvoice with invalid id still proves auth headers
    const url = `${base}/api/v2/External/GetInvoice?id=0`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          kh_kod: cfg.customerCode!.trim(),
          token: cfg.apiToken!.trim(),
          Accept: 'application/xml, application/json, text/plain, */*',
        },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    // 401/403 = bad creds; other statuses (404/500) still mean we reached the API authenticated-ish
    if (res.status === 401 || res.status === 403) {
      const t = await res.text().catch(() => '');
      throw new Error(`Katalog auth HTTP ${res.status}: ${t.slice(0, 120)}`);
    }
  }
}
