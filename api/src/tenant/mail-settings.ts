export type TenantMailSettings = {
  /** Nume afișat în From (ex. „FlotaX Daune”). Envelope rămâne SMTP_FROM. */
  fromName: string | null;
  /** Reply-To (ex. daune@firma.ro sau emailul unui membru). */
  replyTo: string | null;
  /** Semnătură la finalul body (înlocuiește „Fleet Enterprise” dacă e setată). */
  signature: string | null;
  /** CC pe mailurile de daună (avizare / reconstatare / deviz) — adrese libere. */
  defaultCcEmails: string[];
  /** CC pe userId-uri de membri tenant (rezolvate la emailul de login). */
  ccMemberUserIds: string[];
  /** Adaugă automat actorul care apasă Trimite în CC. */
  ccActorOnSend: boolean;
};

export const DEFAULT_TENANT_MAIL_SETTINGS: TenantMailSettings = {
  fromName: null,
  replyTo: null,
  signature: null,
  defaultCcEmails: [],
  ccMemberUserIds: [],
  ccActorOnSend: false,
};

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseEmailList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const e = item.trim().toLowerCase();
    if (!e || !isEmail(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out.slice(0, 20);
}

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(0, 50);
}

export function parseTenantMailSettings(raw: unknown): TenantMailSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_TENANT_MAIL_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  const fromName =
    typeof o.fromName === 'string' && o.fromName.trim() ? o.fromName.trim() : null;
  const replyToRaw =
    typeof o.replyTo === 'string' && o.replyTo.trim() ? o.replyTo.trim() : null;
  const replyTo = replyToRaw && isEmail(replyToRaw) ? replyToRaw : null;
  const signature =
    typeof o.signature === 'string' && o.signature.trim() ? o.signature.trim() : null;
  return {
    fromName,
    replyTo,
    signature,
    defaultCcEmails: parseEmailList(o.defaultCcEmails),
    ccMemberUserIds: parseIdList(o.ccMemberUserIds),
    ccActorOnSend: o.ccActorOnSend === true,
  };
}

export function parseTenantMailSettingsPatch(body: unknown): Partial<TenantMailSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<TenantMailSettings> = {};

  if (o.fromName !== undefined) {
    if (o.fromName !== null && typeof o.fromName !== 'string') {
      throw new Error('fromName must be string or null');
    }
    patch.fromName =
      typeof o.fromName === 'string' && o.fromName.trim() ? o.fromName.trim() : null;
  }
  if (o.replyTo !== undefined) {
    if (o.replyTo !== null && typeof o.replyTo !== 'string') {
      throw new Error('replyTo must be string or null');
    }
    if (o.replyTo === null || o.replyTo === '') {
      patch.replyTo = null;
    } else {
      const e = o.replyTo.trim();
      if (!isEmail(e)) throw new Error('replyTo must be a valid email');
      patch.replyTo = e;
    }
  }
  if (o.signature !== undefined) {
    if (o.signature !== null && typeof o.signature !== 'string') {
      throw new Error('signature must be string or null');
    }
    patch.signature =
      typeof o.signature === 'string' && o.signature.trim() ? o.signature.trim() : null;
  }
  if (o.defaultCcEmails !== undefined) {
    patch.defaultCcEmails = parseEmailList(o.defaultCcEmails);
  }
  if (o.ccMemberUserIds !== undefined) {
    patch.ccMemberUserIds = parseIdList(o.ccMemberUserIds);
  }
  if (o.ccActorOnSend !== undefined) {
    if (typeof o.ccActorOnSend !== 'boolean') throw new Error('ccActorOnSend must be boolean');
    patch.ccActorOnSend = o.ccActorOnSend;
  }
  return patch;
}
