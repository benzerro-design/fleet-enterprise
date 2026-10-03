import {
  DEFAULT_SLA_SETTINGS,
  type SlaPriorityHours,
  type SlaPriorityKey,
} from '../tenant/sla-settings';

/**
 * Override SLA pe client (fișa Clientului).
 * `override: false` = moștenește Setup → Tipuri & servicii → SLA.
 */

export type ClientSlaSettings = {
  override: boolean;
  priorities: Record<SlaPriorityKey, SlaPriorityHours>;
};

const PRIORITY_KEYS: SlaPriorityKey[] = ['urgent', 'high', 'normal', 'low'];

function parseHours(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fallback;
  return Math.round(raw * 10) / 10;
}

function parsePriorityBlock(raw: unknown, fallback: SlaPriorityHours): SlaPriorityHours {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    firstResponseHours: parseHours(o.firstResponseHours, fallback.firstResponseHours),
    resolveHours: parseHours(o.resolveHours, fallback.resolveHours),
  };
}

export const DEFAULT_CLIENT_SLA_SETTINGS: ClientSlaSettings = {
  override: false,
  priorities: {
    urgent: { ...DEFAULT_SLA_SETTINGS.priorities.urgent },
    high: { ...DEFAULT_SLA_SETTINGS.priorities.high },
    normal: { ...DEFAULT_SLA_SETTINGS.priorities.normal },
    low: { ...DEFAULT_SLA_SETTINGS.priorities.low },
  },
};

export function parseClientSlaSettings(raw: unknown): ClientSlaSettings {
  const base = DEFAULT_CLIENT_SLA_SETTINGS;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      override: false,
      priorities: {
        urgent: { ...base.priorities.urgent },
        high: { ...base.priorities.high },
        normal: { ...base.priorities.normal },
        low: { ...base.priorities.low },
      },
    };
  }
  const o = raw as Record<string, unknown>;
  const priRaw =
    o.priorities && typeof o.priorities === 'object' && !Array.isArray(o.priorities)
      ? (o.priorities as Record<string, unknown>)
      : {};
  return {
    override: o.override === true,
    priorities: {
      urgent: parsePriorityBlock(priRaw.urgent, base.priorities.urgent),
      high: parsePriorityBlock(priRaw.high, base.priorities.high),
      normal: parsePriorityBlock(priRaw.normal, base.priorities.normal),
      low: parsePriorityBlock(priRaw.low, base.priorities.low),
    },
  };
}

export function parseClientSlaSettingsPatch(body: unknown): Partial<ClientSlaSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<ClientSlaSettings> = {};
  if ('override' in o) {
    if (typeof o.override !== 'boolean') throw new Error('override must be boolean');
    patch.override = o.override;
  }
  if ('priorities' in o) {
    if (!o.priorities || typeof o.priorities !== 'object' || Array.isArray(o.priorities)) {
      throw new Error('priorities must be an object');
    }
    const pri = o.priorities as Record<string, unknown>;
    const next: ClientSlaSettings['priorities'] = {
      urgent: { ...DEFAULT_SLA_SETTINGS.priorities.urgent },
      high: { ...DEFAULT_SLA_SETTINGS.priorities.high },
      normal: { ...DEFAULT_SLA_SETTINGS.priorities.normal },
      low: { ...DEFAULT_SLA_SETTINGS.priorities.low },
    };
    for (const key of PRIORITY_KEYS) {
      if (key in pri) next[key] = parsePriorityBlock(pri[key], next[key]);
    }
    patch.priorities = next;
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}
