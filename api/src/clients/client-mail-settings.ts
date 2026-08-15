/** Setări CC daună pe client — merge cu Tenant.mailSettings la trimitere. */
export type ClientMailSettings = {
  /** UserId din ClientMembership — email de login. */
  ccMemberUserIds: string[];
  /** Adrese libere (contabilitate client, etc.). */
  ccEmails: string[];
};

export const DEFAULT_CLIENT_MAIL_SETTINGS: ClientMailSettings = {
  ccMemberUserIds: [],
  ccEmails: [],
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

export function parseClientMailSettings(raw: unknown): ClientMailSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CLIENT_MAIL_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    ccMemberUserIds: parseIdList(o.ccMemberUserIds),
    ccEmails: parseEmailList(o.ccEmails),
  };
}

export function parseClientMailSettingsPatch(body: unknown): Partial<ClientMailSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<ClientMailSettings> = {};
  if (o.ccMemberUserIds !== undefined) {
    patch.ccMemberUserIds = parseIdList(o.ccMemberUserIds);
  }
  if (o.ccEmails !== undefined) {
    patch.ccEmails = parseEmailList(o.ccEmails);
  }
  return patch;
}
