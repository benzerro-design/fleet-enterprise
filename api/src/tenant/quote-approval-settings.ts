export type QuoteApprovalBasis = 'net' | 'gross';

export type QuoteApprovalRule = {
  userId: string;
  maxAmountCents: number;
};

export type QuoteApprovalSettings = {
  currency: 'RON';
  basis: QuoteApprovalBasis;
  rules: QuoteApprovalRule[];
};

export const DEFAULT_QUOTE_APPROVAL_SETTINGS: QuoteApprovalSettings = {
  currency: 'RON',
  basis: 'gross',
  rules: [],
};

export function parseQuoteApprovalSettings(raw: unknown): QuoteApprovalSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_QUOTE_APPROVAL_SETTINGS, rules: [] };
  const o = raw as Record<string, unknown>;
  const basis = o.basis === 'net' ? 'net' : 'gross';
  const rules = Array.isArray(o.rules) ? o.rules.map(parseRule).filter((r): r is QuoteApprovalRule => !!r) : [];
  const seen = new Set<string>();
  const unique = rules.filter((r) => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
  return { currency: 'RON', basis, rules: unique };
}

function parseRule(raw: unknown): QuoteApprovalRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const userId = typeof o.userId === 'string' ? o.userId.trim() : '';
  const maxAmountCents = typeof o.maxAmountCents === 'number' ? o.maxAmountCents : Number(o.maxAmountCents);
  if (!userId || !Number.isInteger(maxAmountCents) || maxAmountCents < 0) return null;
  return { userId, maxAmountCents };
}

export function parseQuoteApprovalSettingsBody(body: unknown): QuoteApprovalSettings {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid settings');
  }
  const parsed = parseQuoteApprovalSettings(body);
  const o = body as Record<string, unknown>;
  if (o.basis !== undefined && o.basis !== 'net' && o.basis !== 'gross') {
    throw new Error('basis must be net or gross');
  }
  if (o.currency !== undefined && o.currency !== 'RON') {
    throw new Error('currency must be RON');
  }
  if (!Array.isArray(o.rules)) throw new Error('rules must be an array');
  if (parsed.rules.length !== o.rules.length) {
    throw new Error('Each rule needs userId and a non-negative integer maxAmountCents');
  }
  return parsed;
}
