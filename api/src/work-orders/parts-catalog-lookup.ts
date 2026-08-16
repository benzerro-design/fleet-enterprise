import type { PartsCatalogProviderSetting } from '../tenant/integrations-settings';

export type PartsPriceOffer = {
  providerId: string;
  providerLabel: string;
  unitNetCents: number;
  currency: string;
  availability: 'in_stock' | 'order' | 'unknown';
  /** true = preț sintetic până la conector API real */
  stub: boolean;
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
 * Stub catalog: prețuri deterministe pe cod piesă (fără API Inter Cars încă).
 * Oferte pe providerii activați din Integrări.
 */
export function lookupStubOffers(
  partNumber: string,
  providers: PartsCatalogProviderSetting[],
): PartsPriceOffer[] {
  const enabled = providers.filter((p) => p.enabled);
  if (!enabled.length) return [];

  const h = hashPart(partNumber.trim());
  // Bază ~50–850 RON net, deterministă
  const baseCents = 5000 + (h % 80000);

  return enabled.map((p, idx) => {
    // Variație ușoară pe provider (±0–12%)
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
): PartsPriceVerifyLineResult[] {
  const threshold = Math.max(0, suspectPercent);
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

    const offers = lookupStubOffers(partNumber, providers).sort(
      (a, b) => a.unitNetCents - b.unitNetCents,
    );
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
        message: 'Niciun provider catalog activ',
      };
    }

    const bestUnitNetCents = offers[0].unitNetCents;
    const deltaPercent =
      bestUnitNetCents > 0
        ? Math.round(((quoteUnitNetCents - bestUnitNetCents) / bestUnitNetCents) * 1000) / 10
        : null;
    const suspect =
      deltaPercent != null && deltaPercent > threshold && quoteUnitNetCents > bestUnitNetCents;

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
        ? `Preț cu ${deltaPercent}% peste cel mai ieftin catalog (prag ${threshold}%)`
        : deltaPercent != null && deltaPercent <= 0
          ? 'Preț la sau sub catalog'
          : `În prag (±${threshold}% față de catalog)`,
    };
  });
}
