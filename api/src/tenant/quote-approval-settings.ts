export type QuoteApprovalBasis = 'net' | 'gross';

export type QuoteApprovalRule = {
  clientId: string;
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

/**
 * Citește setările. Formatul vechi (fără clientId pe regulă) se ignoră la reguli —
 * baza net/brut se păstrează dacă e validă.
 */
export function parseQuoteApprovalSettings(raw: unknown): QuoteApprovalSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_QUOTE_APPROVAL_SETTINGS, rules: [] };
  const o = raw as Record<string, unknown>;
  const basis = o.basis === 'net' ? 'net' : 'gross';
  const rules = Array.isArray(o.rules)
    ? o.rules.map(parseRule).filter((r): r is QuoteApprovalRule => !!r)
    : [];
  const seen = new Set<string>();
  const unique = rules.filter((r) => {
    const key = `${r.clientId}:${r.userId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { currency: 'RON', basis, rules: unique };
}

function parseRule(raw: unknown): QuoteApprovalRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const clientId = typeof o.clientId === 'string' ? o.clientId.trim() : '';
  const userId = typeof o.userId === 'string' ? o.userId.trim() : '';
  const maxAmountCents = typeof o.maxAmountCents === 'number' ? o.maxAmountCents : Number(o.maxAmountCents);
  if (!clientId || !userId || !Number.isInteger(maxAmountCents) || maxAmountCents < 0) return null;
  return { clientId, userId, maxAmountCents };
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
    throw new Error('Each rule needs clientId, userId and a non-negative integer maxAmountCents');
  }
  return parsed;
}

/** Înlocuiește regulile unui client; păstrează restul. */
export function mergeClientRules(
  current: QuoteApprovalSettings,
  clientId: string,
  clientRules: Array<{ userId: string; maxAmountCents: number }>,
): QuoteApprovalSettings {
  const id = clientId.trim();
  if (!id) throw new Error('clientId is required');
  const others = current.rules.filter((r) => r.clientId !== id);
  const seen = new Set<string>();
  const nextForClient: QuoteApprovalRule[] = [];
  for (const row of clientRules) {
    const userId = typeof row.userId === 'string' ? row.userId.trim() : '';
    const maxAmountCents =
      typeof row.maxAmountCents === 'number' ? row.maxAmountCents : Number(row.maxAmountCents);
    if (!userId || !Number.isInteger(maxAmountCents) || maxAmountCents < 0) {
      throw new Error('Each client rule needs userId and a non-negative integer maxAmountCents');
    }
    if (seen.has(userId)) continue;
    seen.add(userId);
    nextForClient.push({ clientId: id, userId, maxAmountCents });
  }
  return {
    currency: 'RON',
    basis: current.basis,
    rules: [...others, ...nextForClient],
  };
}

export function ruleForApprover(
  settings: QuoteApprovalSettings,
  clientId: string,
  userId: string,
): QuoteApprovalRule | null {
  return (
    settings.rules.find((r) => r.clientId === clientId && r.userId === userId) ?? null
  );
}
