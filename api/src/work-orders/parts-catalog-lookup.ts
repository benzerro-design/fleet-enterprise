import type { PartsCatalogProviderSetting } from '../tenant/integrations-settings';

export type PartsPriceOffer = {
  providerId: string;
  providerLabel: string;
  unitNetCents: number;
  currency: string;
  availability: 'in_stock' | 'order' | 'unknown';
  /** true = preț sintetic până la conector API real */
  stub: boolean;
  sku?: string | null;
  name?: string | null;
};

export type PartsPriceVerifyLineInput = {
  key?: string;
  lineType?: string;
  partNumber?: string | null;
  unitNetCents: number;
};

export type PartsPriceVerifyLineResult = {
  key: string;
  partNumber: string | null;
  quoteUnitNetCents: number;
  offers: PartsPriceOffer[];
  bestUnitNetCents: number | null;
  deltaPercent: number | null;
  suspect: boolean;
  status: 'ok' | 'suspect' | 'no_code' | 'not_found' | 'skipped';
  message: string | null;
};

function hashPart(partNumber: string): number {
  let h = 0;
  const u = partNumber.toUpperCase();
  for (let i = 0; i < u.length; i++) {
    h = (h * 31 + u.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Stub catalog: prețuri deterministe pe cod piesă.
 * Folosit când API Inter Cars lipsește / eșuează și allowStubFallback.
 */
export function lookupStubOffers(
  partNumber: string,
  providers: PartsCatalogProviderSetting[],
): PartsPriceOffer[] {
  const enabled = providers.filter((p) => p.enabled);
  if (!enabled.length) return [];

  const h = hashPart(partNumber.trim());
  const baseCents = 5000 + (h % 80000);

  return enabled.map((p, idx) => {
    const factor = 1 + ((h >> (idx * 3)) % 13) / 100 - 0.04;
    const unitNetCents = Math.max(100, Math.round(baseCents * factor));
    const availability: PartsPriceOffer['availability'] =
      (h + idx) % 5 === 0 ? 'order' : (h + idx) % 7 === 0 ? 'unknown' : 'in_stock';
    return {
      providerId: p.id,
      providerLabel: p.label,
      unitNetCents,
      currency: 'RON',
      availability,
      stub: true,
    };
  });
}

export function buildPartsPriceVerifyResults(
  lines: PartsPriceVerifyLineInput[],
  providers: PartsCatalogProviderSetting[],
  suspectPercent: number,
  offersByPartNumber?: Map<string, PartsPriceOffer[]>,
  options?: { allowStubFallback?: boolean },
): PartsPriceVerifyLineResult[] {
  const threshold = Math.max(0, suspectPercent);
  const allowStub = options?.allowStubFallback !== false;
  return lines.map((line, idx) => {
    const key = line.key?.trim() || `line-${idx}`;
    const quoteUnitNetCents = Math.round(Number(line.unitNetCents) || 0);
    const lineType = line.lineType ?? 'parts';

    if (lineType !== 'parts') {
      return {
        key,
        partNumber: line.partNumber?.trim() || null,
        quoteUnitNetCents,
        offers: [],
        bestUnitNetCents: null,
        deltaPercent: null,
        suspect: false,
        status: 'skipped',
        message: 'Doar liniile de tip piese sunt verificate',
      };
    }

    const partNumber = line.partNumber?.trim() || null;
    if (!partNumber) {
      return {
        key,
        partNumber: null,
        quoteUnitNetCents,
        offers: [],
        bestUnitNetCents: null,
        deltaPercent: null,
        suspect: false,
        status: 'no_code',
        message: 'Lipsă cod piesă',
      };
    }

    let offers =
      offersByPartNumber?.get(partNumber) ??
      offersByPartNumber?.get(partNumber.toUpperCase()) ??
      [];
    if (!offers.length && allowStub) {
      offers = lookupStubOffers(partNumber, providers);
    }
    offers = [...offers].sort((a, b) => a.unitNetCents - b.unitNetCents);

    if (!offers.length) {
      return {
        key,
        partNumber,
        quoteUnitNetCents,
        offers: [],
        bestUnitNetCents: null,
        deltaPercent: null,
        suspect: false,
        status: 'not_found',
        message: allowStub
          ? 'Nicio ofertă catalog pentru acest cod'
          : 'Nicio ofertă Inter Cars (stub dezactivat)',
      };
    }

    const bestUnitNetCents = offers[0].unitNetCents;
    const deltaPercent =
      bestUnitNetCents > 0
        ? Math.round(((quoteUnitNetCents - bestUnitNetCents) / bestUnitNetCents) * 1000) / 10
        : null;
    const suspect =
      deltaPercent != null && deltaPercent > threshold && quoteUnitNetCents > bestUnitNetCents;
    const fromApi = offers.some((o) => !o.stub);

    return {
      key,
      partNumber,
      quoteUnitNetCents,
      offers,
      bestUnitNetCents,
      deltaPercent,
      suspect,
      status: suspect ? 'suspect' : 'ok',
      message: suspect
        ? `Preț cu ${deltaPercent}% peste cel mai ieftin catalog (prag ${threshold}%)${fromApi ? '' : ' · stub'}`
        : deltaPercent != null && deltaPercent <= 0
          ? fromApi
            ? 'Preț la sau sub catalog'
            : 'Preț la sau sub catalog (stub)'
          : `În prag (±${threshold}% față de catalog)${fromApi ? '' : ' · stub'}`,
    };
  });
}
