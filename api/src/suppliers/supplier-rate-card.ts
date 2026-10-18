/** PARTNER-014 — fișă tarifară atelier (Faza A / C). */

import { effectiveSupplierDiscountDefaults } from './supplier-discount-eligibility';

export type PartsPriceBasis = 'list' | 'net';

export type SupplierRateCard = {
  laborRateMechanicalCents: number | null;
  laborRateBodyCents: number | null;
  laborRatePaintCents: number | null;
  laborRateDiagnosticCents: number | null;
  partsPriceBasis: PartsPriceBasis;
  pricingNotes: string | null;
};

export function parsePartsPriceBasis(raw: unknown): PartsPriceBasis {
  return raw === 'net' ? 'net' : 'list';
}

/**
 * RON (string/number) → cenți.
 * `undefined` = câmp absent din patch; `null`/gol = șterge tarif.
 */
export function parseOptionalRonToCents(
  raw: unknown,
  field: string,
): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${field} must be a non-negative RON amount`);
  }
  return Math.round(n * 100);
}

export function centsToRonNumber(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return Math.round(cents) / 100;
}

/**
 * Prefill preț unitar pe linie manoperă: mecanic ca default general.
 */
export function defaultLaborUnitCents(
  card: Pick<
    SupplierRateCard,
    | 'laborRateMechanicalCents'
    | 'laborRateBodyCents'
    | 'laborRatePaintCents'
    | 'laborRateDiagnosticCents'
  > | null | undefined,
): number | null {
  if (!card) return null;
  const candidates = [
    card.laborRateMechanicalCents,
    card.laborRateBodyCents,
    card.laborRatePaintCents,
    card.laborRateDiagnosticCents,
  ];
  for (const c of candidates) {
    if (c != null && Number.isFinite(c) && c > 0) return Math.round(c);
  }
  return null;
}

/** Când baza e net, discountul default pe piese e forțat la 0. */
export function effectivePartsDiscountForBasis(
  basis: PartsPriceBasis,
  partsDiscountPercent: number,
): number {
  if (basis === 'net') return 0;
  return Number(partsDiscountPercent) || 0;
}

export type SupplierRatePatchInput = {
  laborRateMechanicalRon?: number | string | null;
  laborRateBodyRon?: number | string | null;
  laborRatePaintRon?: number | string | null;
  laborRateDiagnosticRon?: number | string | null;
  partsPriceBasis?: PartsPriceBasis | string | null;
  pricingNotes?: string | null;
};

export type SupplierRateCentsPatch = {
  laborRateMechanicalCents?: number | null;
  laborRateBodyCents?: number | null;
  laborRatePaintCents?: number | null;
  laborRateDiagnosticCents?: number | null;
  partsPriceBasis?: PartsPriceBasis;
  pricingNotes?: string | null;
};

/** Câmp absent = nu intra în patch. `null`/gol pe tarif = șterge. */
export function parseSupplierRatePatch(dto: SupplierRatePatchInput): SupplierRateCentsPatch {
  const data: SupplierRateCentsPatch = {};
  if (dto.laborRateMechanicalRon !== undefined) {
    data.laborRateMechanicalCents = parseOptionalRonToCents(
      dto.laborRateMechanicalRon,
      'laborRateMechanicalRon',
    );
  }
  if (dto.laborRateBodyRon !== undefined) {
    data.laborRateBodyCents = parseOptionalRonToCents(dto.laborRateBodyRon, 'laborRateBodyRon');
  }
  if (dto.laborRatePaintRon !== undefined) {
    data.laborRatePaintCents = parseOptionalRonToCents(dto.laborRatePaintRon, 'laborRatePaintRon');
  }
  if (dto.laborRateDiagnosticRon !== undefined) {
    data.laborRateDiagnosticCents = parseOptionalRonToCents(
      dto.laborRateDiagnosticRon,
      'laborRateDiagnosticRon',
    );
  }
  if (dto.partsPriceBasis !== undefined && dto.partsPriceBasis !== null) {
    data.partsPriceBasis = parsePartsPriceBasis(dto.partsPriceBasis);
  }
  if (dto.pricingNotes !== undefined) {
    data.pricingNotes = dto.pricingNotes?.trim() || null;
  }
  return data;
}

/** 0–100. `null`/gol = 0. Aruncă `Error` (apelantul mapează la 400). */
export function parseDiscountPercent(raw: unknown, field: string): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`${field} must be 0–100`);
  }
  return Math.round(n * 100) / 100;
}

/** Bază din patch; `null`/absent păstrează valoarea stocată. */
export function nextPartsPriceBasis(patchRaw: unknown, stored: unknown): PartsPriceBasis {
  if (patchRaw !== undefined && patchRaw !== null) return parsePartsPriceBasis(patchRaw);
  return parsePartsPriceBasis(stored);
}

export type SupplierDiscountPatch = {
  partsDiscountPercent?: number;
  laborDiscountPercent?: number;
};

/**
 * Patch discounturi.
 * Categorie neeligibilă: ambele la 0, fără parsare.
 * Bază net: discount piese forțat la 0 dacă vine discountul sau baza.
 * Manopera nu e afectată de baza net.
 */
export function resolveSupplierDiscountPatch(input: {
  discountsEligible: boolean;
  storedPartsPriceBasis: unknown;
  partsPriceBasis: unknown;
  partsDiscountPercent: unknown;
  laborDiscountPercent: unknown;
}): SupplierDiscountPatch {
  if (!input.discountsEligible) {
    return { partsDiscountPercent: 0, laborDiscountPercent: 0 };
  }
  const nextBasis = nextPartsPriceBasis(input.partsPriceBasis, input.storedPartsPriceBasis);
  const out: SupplierDiscountPatch = {};
  if (input.partsDiscountPercent !== undefined) {
    out.partsDiscountPercent =
      nextBasis === 'net'
        ? 0
        : parseDiscountPercent(input.partsDiscountPercent, 'partsDiscountPercent');
  } else if (nextBasis === 'net' && input.partsPriceBasis !== undefined) {
    out.partsDiscountPercent = 0;
  }
  if (input.laborDiscountPercent !== undefined) {
    out.laborDiscountPercent = parseDiscountPercent(
      input.laborDiscountPercent,
      'laborDiscountPercent',
    );
  }
  return out;
}

/** Create: ambele discounturi obligatorii; bază net → piese 0. */
export function resolveSupplierCreateDiscounts(input: {
  discountsEligible: boolean;
  partsPriceBasis: unknown;
  partsDiscountPercent: unknown;
  laborDiscountPercent: unknown;
}): Required<SupplierDiscountPatch> {
  if (!input.discountsEligible) {
    return { partsDiscountPercent: 0, laborDiscountPercent: 0 };
  }
  const basis = parsePartsPriceBasis(input.partsPriceBasis);
  return {
    partsDiscountPercent:
      basis === 'net'
        ? 0
        : parseDiscountPercent(input.partsDiscountPercent, 'partsDiscountPercent'),
    laborDiscountPercent: parseDiscountPercent(
      input.laborDiscountPercent,
      'laborDiscountPercent',
    ),
  };
}

/** Overlay pe alocare Client↔Furnizor (PARTNER-014 Faza C). Null = moștenește catalogul. */
export type ClientSupplierRateOverlay = {
  partsDiscountPercent: number | null;
  laborDiscountPercent: number | null;
  laborRateMechanicalCents: number | null;
  laborRateBodyCents: number | null;
  laborRatePaintCents: number | null;
  laborRateDiagnosticCents: number | null;
  partsPriceBasis: string | null;
  pricingNotes: string | null;
};

export type MergedSupplierRates = {
  partsDiscountPercent: number;
  laborDiscountPercent: number;
  laborRateMechanicalCents: number | null;
  laborRateBodyCents: number | null;
  laborRatePaintCents: number | null;
  laborRateDiagnosticCents: number | null;
  partsPriceBasis: PartsPriceBasis;
  pricingNotes: string | null;
  /** True dacă cel puțin un câmp overlay e setat. */
  overlayActive: boolean;
};

export type SupplierCatalogRates = {
  category?: string | null;
  partsDiscountPercent: number | null | undefined;
  laborDiscountPercent: number | null | undefined;
  laborRateMechanicalCents?: number | null;
  laborRateBodyCents?: number | null;
  laborRatePaintCents?: number | null;
  laborRateDiagnosticCents?: number | null;
  partsPriceBasis?: unknown;
  pricingNotes?: string | null;
};

function overlayFieldActive(raw: unknown): boolean {
  return raw !== undefined && raw !== null && raw !== '';
}

export function isClientSupplierOverlayActive(
  overlay: Partial<ClientSupplierRateOverlay> | null | undefined,
): boolean {
  if (!overlay) return false;
  return (
    overlayFieldActive(overlay.partsDiscountPercent) ||
    overlayFieldActive(overlay.laborDiscountPercent) ||
    overlayFieldActive(overlay.laborRateMechanicalCents) ||
    overlayFieldActive(overlay.laborRateBodyCents) ||
    overlayFieldActive(overlay.laborRatePaintCents) ||
    overlayFieldActive(overlay.laborRateDiagnosticCents) ||
    overlayFieldActive(overlay.partsPriceBasis) ||
    (overlay.pricingNotes != null && String(overlay.pricingNotes).trim() !== '')
  );
}

/**
 * Overlay înaintea catalogului furnizor.
 * Null pe câmp overlay = moștenește; 0 e override valid.
 * Bază net → discount piese efectiv 0.
 */
export function mergeClientSupplierRateOverlay(
  catalog: SupplierCatalogRates,
  overlay?: Partial<ClientSupplierRateOverlay> | null,
): MergedSupplierRates {
  const partsPriceBasis = overlayFieldActive(overlay?.partsPriceBasis)
    ? parsePartsPriceBasis(overlay!.partsPriceBasis)
    : parsePartsPriceBasis(catalog.partsPriceBasis);

  const partsRaw =
    overlay?.partsDiscountPercent != null
      ? overlay.partsDiscountPercent
      : catalog.partsDiscountPercent;
  const laborRaw =
    overlay?.laborDiscountPercent != null
      ? overlay.laborDiscountPercent
      : catalog.laborDiscountPercent;

  const disc = effectiveSupplierDiscountDefaults(catalog.category, partsRaw, laborRaw);
  const partsDiscountPercent = effectivePartsDiscountForBasis(
    partsPriceBasis,
    disc.partsDiscountPercent,
  );
  const laborDiscountPercent = disc.laborDiscountPercent;

  return {
    partsDiscountPercent,
    laborDiscountPercent,
    laborRateMechanicalCents:
      overlay?.laborRateMechanicalCents != null
        ? overlay.laborRateMechanicalCents
        : (catalog.laborRateMechanicalCents ?? null),
    laborRateBodyCents:
      overlay?.laborRateBodyCents != null
        ? overlay.laborRateBodyCents
        : (catalog.laborRateBodyCents ?? null),
    laborRatePaintCents:
      overlay?.laborRatePaintCents != null
        ? overlay.laborRatePaintCents
        : (catalog.laborRatePaintCents ?? null),
    laborRateDiagnosticCents:
      overlay?.laborRateDiagnosticCents != null
        ? overlay.laborRateDiagnosticCents
        : (catalog.laborRateDiagnosticCents ?? null),
    partsPriceBasis,
    pricingNotes:
      overlay?.pricingNotes != null
        ? overlay.pricingNotes.trim() || null
        : (catalog.pricingNotes ?? null),
    overlayActive: isClientSupplierOverlayActive(overlay),
  };
}

/** Optional discount %: undefined = absent, null/gol = șterge overlay, număr = set. */
export function parseOptionalDiscountPercent(
  raw: unknown,
  field: string,
): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  return parseDiscountPercent(raw, field);
}

/** Optional bază: undefined = absent, null/gol = șterge overlay, altfel list|net. */
export function parseOptionalPartsPriceBasis(
  raw: unknown,
): PartsPriceBasis | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  return parsePartsPriceBasis(raw);
}

export type ClientSupplierOverlayPatchInput = {
  laborRateMechanicalRon?: number | string | null;
  laborRateBodyRon?: number | string | null;
  laborRatePaintRon?: number | string | null;
  laborRateDiagnosticRon?: number | string | null;
  partsPriceBasis?: PartsPriceBasis | string | null;
  partsDiscountPercent?: number | string | null;
  laborDiscountPercent?: number | string | null;
  pricingNotes?: string | null;
};

export type ClientSupplierOverlayCentsPatch = {
  laborRateMechanicalCents?: number | null;
  laborRateBodyCents?: number | null;
  laborRatePaintCents?: number | null;
  laborRateDiagnosticCents?: number | null;
  partsPriceBasis?: string | null;
  partsDiscountPercent?: number | null;
  laborDiscountPercent?: number | null;
  pricingNotes?: string | null;
};

/** Patch overlay: câmp absent = neschimbat; null/gol = moștenește din nou catalogul. */
export function parseClientSupplierOverlayPatch(
  dto: ClientSupplierOverlayPatchInput,
): ClientSupplierOverlayCentsPatch {
  const data: ClientSupplierOverlayCentsPatch = {};
  if (dto.laborRateMechanicalRon !== undefined) {
    data.laborRateMechanicalCents = parseOptionalRonToCents(
      dto.laborRateMechanicalRon,
      'laborRateMechanicalRon',
    );
  }
  if (dto.laborRateBodyRon !== undefined) {
    data.laborRateBodyCents = parseOptionalRonToCents(dto.laborRateBodyRon, 'laborRateBodyRon');
  }
  if (dto.laborRatePaintRon !== undefined) {
    data.laborRatePaintCents = parseOptionalRonToCents(dto.laborRatePaintRon, 'laborRatePaintRon');
  }
  if (dto.laborRateDiagnosticRon !== undefined) {
    data.laborRateDiagnosticCents = parseOptionalRonToCents(
      dto.laborRateDiagnosticRon,
      'laborRateDiagnosticRon',
    );
  }
  if (dto.partsPriceBasis !== undefined) {
    data.partsPriceBasis = parseOptionalPartsPriceBasis(dto.partsPriceBasis) ?? null;
  }
  if (dto.partsDiscountPercent !== undefined) {
    data.partsDiscountPercent = parseOptionalDiscountPercent(
      dto.partsDiscountPercent,
      'partsDiscountPercent',
    );
  }
  if (dto.laborDiscountPercent !== undefined) {
    data.laborDiscountPercent = parseOptionalDiscountPercent(
      dto.laborDiscountPercent,
      'laborDiscountPercent',
    );
  }
  if (dto.pricingNotes !== undefined) {
    data.pricingNotes = dto.pricingNotes?.trim() || null;
  }
  return data;
}
