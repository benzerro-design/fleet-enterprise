/** Canonical stay location: `BAY/BIN` (ex. `A/12`). Free-text without `/` stays as bay-only. */

export type StayLocationParts = {
  bayCode: string | null;
  binCode: string | null;
  /** Normalized composed code, or null if empty. */
  locationCode: string | null;
};

export function parseStayLocation(raw: string | null | undefined): StayLocationParts {
  const text = raw?.trim() ?? '';
  if (!text) return { bayCode: null, binCode: null, locationCode: null };
  const slash = text.indexOf('/');
  if (slash < 0) {
    const bay = text.toUpperCase();
    return { bayCode: bay, binCode: null, locationCode: bay };
  }
  const bay = text.slice(0, slash).trim().toUpperCase() || null;
  const bin = text.slice(slash + 1).trim().toUpperCase() || null;
  return {
    bayCode: bay,
    binCode: bin,
    locationCode: formatStayLocation(bay, bin),
  };
}

export function formatStayLocation(
  bayCode: string | null | undefined,
  binCode: string | null | undefined,
): string | null {
  const bay = bayCode?.trim().toUpperCase() || '';
  const bin = binCode?.trim().toUpperCase() || '';
  if (!bay && !bin) return null;
  if (!bin) return bay || null;
  if (!bay) return bin;
  return `${bay}/${bin}`;
}

/** Accept either composed locationCode or separate bay/bin. Prefer full locationCode when set. */
export function resolveStayLocationInput(input: {
  locationCode?: string | null;
  bayCode?: string | null;
  binCode?: string | null;
}): StayLocationParts {
  const composed = input.locationCode?.trim();
  if (composed) {
    return parseStayLocation(composed);
  }
  return parseStayLocation(formatStayLocation(input.bayCode, input.binCode));
}
