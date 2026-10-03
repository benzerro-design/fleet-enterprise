import type { CrmTicketPriority, CrmTicketType } from '@prisma/client';

export type SlaPriorityHours = {
  firstResponseHours: number;
  resolveHours: number;
};

export type SlaPriorityKey = 'urgent' | 'high' | 'normal' | 'low';

export const TICKET_TYPES_FOR_SLA: CrmTicketType[] = [
  'damage',
  'technical',
  'maintenance',
  'itp',
  'transport',
  'document',
  'other',
];

/** Mapare tip → prioritate implicită (auto-prioritizare). */
export const DEFAULT_PRIORITY_BY_TYPE: Record<CrmTicketType, CrmTicketPriority> = {
  damage: 'urgent',
  technical: 'high',
  maintenance: 'normal',
  itp: 'normal',
  transport: 'normal',
  document: 'low',
  other: 'normal',
};

export type TenantSlaSettings = {
  enabled: boolean;
  priorities: Record<SlaPriorityKey, SlaPriorityHours>;
  /** Dacă true și prioritatea lipsește la create, o derivează din tipul tichetului. */
  autoPrioritizeFromType: boolean;
  /** Mapare tip tichet → prioritate (folosită când autoPrioritizeFromType e activ). */
  priorityByType: Record<CrmTicketType, CrmTicketPriority>;
};

export const DEFAULT_SLA_SETTINGS: TenantSlaSettings = {
  enabled: true,
  autoPrioritizeFromType: true,
  priorities: {
    urgent: { firstResponseHours: 1, resolveHours: 8 },
    high: { firstResponseHours: 4, resolveHours: 24 },
    normal: { firstResponseHours: 8, resolveHours: 72 },
    low: { firstResponseHours: 24, resolveHours: 120 },
  },
  priorityByType: { ...DEFAULT_PRIORITY_BY_TYPE },
};

const PRIORITY_KEYS: SlaPriorityKey[] = ['urgent', 'high', 'normal', 'low'];

function parseHours(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fallback;
  return Math.round(raw * 10) / 10;
}

function parsePriorityBlock(
  raw: unknown,
  fallback: SlaPriorityHours,
): SlaPriorityHours {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    firstResponseHours: parseHours(o.firstResponseHours, fallback.firstResponseHours),
    resolveHours: parseHours(o.resolveHours, fallback.resolveHours),
  };
}

function isPriority(raw: unknown): raw is CrmTicketPriority {
  return raw === 'urgent' || raw === 'high' || raw === 'normal' || raw === 'low';
}

function parsePriorityByType(raw: unknown): Record<CrmTicketType, CrmTicketPriority> {
  const out: Record<CrmTicketType, CrmTicketPriority> = { ...DEFAULT_PRIORITY_BY_TYPE };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  for (const type of TICKET_TYPES_FOR_SLA) {
    if (isPriority(o[type])) out[type] = o[type];
  }
  return out;
}

export function parseSlaSettings(raw: unknown): TenantSlaSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      enabled: DEFAULT_SLA_SETTINGS.enabled,
      autoPrioritizeFromType: DEFAULT_SLA_SETTINGS.autoPrioritizeFromType,
      priorities: {
        urgent: { ...DEFAULT_SLA_SETTINGS.priorities.urgent },
        high: { ...DEFAULT_SLA_SETTINGS.priorities.high },
        normal: { ...DEFAULT_SLA_SETTINGS.priorities.normal },
        low: { ...DEFAULT_SLA_SETTINGS.priorities.low },
      },
      priorityByType: { ...DEFAULT_PRIORITY_BY_TYPE },
    };
  }
  const o = raw as Record<string, unknown>;
  const priRaw =
    o.priorities && typeof o.priorities === 'object' && !Array.isArray(o.priorities)
      ? (o.priorities as Record<string, unknown>)
      : {};
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_SLA_SETTINGS.enabled,
    autoPrioritizeFromType:
      typeof o.autoPrioritizeFromType === 'boolean'
        ? o.autoPrioritizeFromType
        : DEFAULT_SLA_SETTINGS.autoPrioritizeFromType,
    priorities: {
      urgent: parsePriorityBlock(priRaw.urgent, DEFAULT_SLA_SETTINGS.priorities.urgent),
      high: parsePriorityBlock(priRaw.high, DEFAULT_SLA_SETTINGS.priorities.high),
      normal: parsePriorityBlock(priRaw.normal, DEFAULT_SLA_SETTINGS.priorities.normal),
      low: parsePriorityBlock(priRaw.low, DEFAULT_SLA_SETTINGS.priorities.low),
    },
    priorityByType: parsePriorityByType(o.priorityByType),
  };
}

export function parseSlaSettingsPatch(body: unknown): Partial<TenantSlaSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<TenantSlaSettings> = {};
  if ('enabled' in o) {
    if (typeof o.enabled !== 'boolean') throw new Error('enabled must be boolean');
    patch.enabled = o.enabled;
  }
  if ('autoPrioritizeFromType' in o) {
    if (typeof o.autoPrioritizeFromType !== 'boolean') {
      throw new Error('autoPrioritizeFromType must be boolean');
    }
    patch.autoPrioritizeFromType = o.autoPrioritizeFromType;
  }
  if ('priorities' in o) {
    if (!o.priorities || typeof o.priorities !== 'object' || Array.isArray(o.priorities)) {
      throw new Error('priorities must be an object');
    }
    const pri = o.priorities as Record<string, unknown>;
    const next: TenantSlaSettings['priorities'] = {
      urgent: { ...DEFAULT_SLA_SETTINGS.priorities.urgent },
      high: { ...DEFAULT_SLA_SETTINGS.priorities.high },
      normal: { ...DEFAULT_SLA_SETTINGS.priorities.normal },
      low: { ...DEFAULT_SLA_SETTINGS.priorities.low },
    };
    for (const key of PRIORITY_KEYS) {
      if (key in pri) next[key] = parsePriorityBlock(pri[key], DEFAULT_SLA_SETTINGS.priorities[key]);
    }
    patch.priorities = next;
  }
  if ('priorityByType' in o) {
    if (!o.priorityByType || typeof o.priorityByType !== 'object' || Array.isArray(o.priorityByType)) {
      throw new Error('priorityByType must be an object');
    }
    patch.priorityByType = parsePriorityByType(o.priorityByType);
  }
  return patch;
}

export function suggestedPriorityForTicketType(
  type: CrmTicketType,
  settings?: Pick<TenantSlaSettings, 'priorityByType'> | null,
): CrmTicketPriority {
  const map = settings?.priorityByType ?? DEFAULT_PRIORITY_BY_TYPE;
  return map[type] ?? 'normal';
}

export function computeSlaDeadlines(
  settings: TenantSlaSettings,
  priority: CrmTicketPriority,
  from: Date = new Date(),
): { firstResponseDueAt: Date | null; resolveDueAt: Date | null } {
  if (!settings.enabled) {
    return { firstResponseDueAt: null, resolveDueAt: null };
  }
  const key = priority as keyof TenantSlaSettings['priorities'];
  const block = settings.priorities[key] ?? settings.priorities.normal;
  const frMs = block.firstResponseHours * 60 * 60 * 1000;
  const reMs = block.resolveHours * 60 * 60 * 1000;
  return {
    firstResponseDueAt: new Date(from.getTime() + frMs),
    resolveDueAt: new Date(from.getTime() + reMs),
  };
}

/**
 * Merge override client peste setările tenant.
 * Dacă client.override e false → doar tenant.
 */
export function mergeSlaSettings(
  tenant: TenantSlaSettings,
  clientOverride: {
    override: boolean;
    priorities?: Partial<Record<SlaPriorityKey, SlaPriorityHours>> | null;
  } | null | undefined,
): TenantSlaSettings {
  if (!clientOverride?.override || !clientOverride.priorities) {
    return tenant;
  }
  const priorities = { ...tenant.priorities };
  for (const key of PRIORITY_KEYS) {
    const block = clientOverride.priorities[key];
    if (block) {
      priorities[key] = {
        firstResponseHours: block.firstResponseHours,
        resolveHours: block.resolveHours,
      };
    }
  }
  return { ...tenant, priorities };
}

export type TicketSlaStatus =
  | 'ok'
  | 'first_response_overdue'
  | 'resolve_overdue'
  | 'disabled'
  | 'resolved';

export function ticketSlaStatus(input: {
  enabled: boolean;
  status: string;
  resolvedAt: Date | string | null;
  firstResponseDueAt: Date | string | null;
  resolveDueAt: Date | string | null;
  firstRespondedAt: Date | string | null;
  now?: Date;
}): TicketSlaStatus {
  if (!input.enabled) return 'disabled';
  if (input.resolvedAt || input.status === 'resolved' || input.status === 'closed') {
    return 'resolved';
  }
  const now = input.now ?? new Date();
  const resolveDue = input.resolveDueAt ? new Date(input.resolveDueAt) : null;
  if (resolveDue && resolveDue.getTime() < now.getTime()) return 'resolve_overdue';
  if (!input.firstRespondedAt) {
    const frDue = input.firstResponseDueAt ? new Date(input.firstResponseDueAt) : null;
    if (frDue && frDue.getTime() < now.getTime()) return 'first_response_overdue';
  }
  return 'ok';
}
