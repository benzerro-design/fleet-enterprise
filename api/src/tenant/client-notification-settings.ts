/**
 * SETUP-006 — Notificări client (tenant).
 * Matrice email × eveniment × rol. Nu SMTP (Setup → Email), nu partener.
 */

export type NotificationRole = 'l1' | 'l0' | 'l_star';

export type NotificationEvent =
  | 'ticket_created'
  | 'ticket_status_changed'
  | 'ticket_comment'
  | 'appointment_proposed'
  | 'appointment_confirmed'
  | 'appointment_reproposed'
  | 'ticket_resolved'
  | 'sla_breached';

export type EventChannelSetting = {
  email: boolean;
  roles: NotificationRole[];
};

export type TenantClientNotificationSettings = {
  /** Master switch pentru email pe acest pilon. */
  emailEnabled: boolean;
  events: Record<NotificationEvent, EventChannelSetting>;
};

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  'ticket_created',
  'ticket_status_changed',
  'ticket_comment',
  'appointment_proposed',
  'appointment_confirmed',
  'appointment_reproposed',
  'ticket_resolved',
  'sla_breached',
];

export const NOTIFICATION_ROLES: NotificationRole[] = ['l1', 'l0', 'l_star'];

const ROLE_SET = new Set<string>(NOTIFICATION_ROLES);

function roles(list: NotificationRole[]): NotificationRole[] {
  return [...list];
}

/** Defaults conservatoare: programări + rezolvare ON; comentarii OFF. */
export const DEFAULT_CLIENT_NOTIFICATION_SETTINGS: TenantClientNotificationSettings = {
  emailEnabled: true,
  events: {
    ticket_created: { email: false, roles: roles(['l1']) },
    ticket_status_changed: { email: false, roles: roles(['l1']) },
    ticket_comment: { email: false, roles: roles(['l1']) },
    appointment_proposed: { email: true, roles: roles(['l1']) },
    appointment_confirmed: { email: true, roles: roles(['l1', 'l0']) },
    appointment_reproposed: { email: true, roles: roles(['l1']) },
    ticket_resolved: { email: true, roles: roles(['l1']) },
    sla_breached: { email: true, roles: roles(['l1', 'l_star']) },
  },
};

function parseRoles(raw: unknown, fallback: NotificationRole[]): NotificationRole[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: NotificationRole[] = [];
  const seen = new Set<NotificationRole>();
  for (const item of raw) {
    if (typeof item !== 'string' || !ROLE_SET.has(item)) continue;
    const r = item as NotificationRole;
    if (seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  return out.length > 0 ? out : [...fallback];
}

function parseEventBlock(
  raw: unknown,
  fallback: EventChannelSetting,
): EventChannelSetting {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { email: fallback.email, roles: [...fallback.roles] };
  }
  const o = raw as Record<string, unknown>;
  return {
    email: typeof o.email === 'boolean' ? o.email : fallback.email,
    roles: parseRoles(o.roles, fallback.roles),
  };
}

export function parseClientNotificationSettings(
  raw: unknown,
): TenantClientNotificationSettings {
  const base = DEFAULT_CLIENT_NOTIFICATION_SETTINGS;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      emailEnabled: base.emailEnabled,
      events: Object.fromEntries(
        NOTIFICATION_EVENTS.map((e) => [
          e,
          { email: base.events[e].email, roles: [...base.events[e].roles] },
        ]),
      ) as TenantClientNotificationSettings['events'],
    };
  }
  const o = raw as Record<string, unknown>;
  const eventsRaw =
    o.events && typeof o.events === 'object' && !Array.isArray(o.events)
      ? (o.events as Record<string, unknown>)
      : {};
  const events = {} as TenantClientNotificationSettings['events'];
  for (const key of NOTIFICATION_EVENTS) {
    events[key] = parseEventBlock(eventsRaw[key], base.events[key]);
  }
  return {
    emailEnabled: typeof o.emailEnabled === 'boolean' ? o.emailEnabled : base.emailEnabled,
    events,
  };
}

export function parseClientNotificationSettingsPatch(
  body: unknown,
): Partial<TenantClientNotificationSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const patch: Partial<TenantClientNotificationSettings> = {};
  if ('emailEnabled' in o) {
    if (typeof o.emailEnabled !== 'boolean') throw new Error('emailEnabled must be boolean');
    patch.emailEnabled = o.emailEnabled;
  }
  if ('events' in o) {
    if (!o.events || typeof o.events !== 'object' || Array.isArray(o.events)) {
      throw new Error('events must be an object');
    }
    const eventsIn = o.events as Record<string, unknown>;
    const partialEvents: Partial<TenantClientNotificationSettings['events']> = {};
    for (const key of NOTIFICATION_EVENTS) {
      if (key in eventsIn) {
        partialEvents[key] = parseEventBlock(
          eventsIn[key],
          DEFAULT_CLIENT_NOTIFICATION_SETTINGS.events[key],
        );
      }
    }
    if (Object.keys(partialEvents).length === 0) {
      throw new Error('events must include at least one event');
    }
    // Service merges over current; cast is intentional for Partial storage in patch.
    patch.events = partialEvents as TenantClientNotificationSettings['events'];
  }
  if (Object.keys(patch).length === 0) throw new Error('No settings to update');
  return patch;
}

/** Helper pentru runtime (când apare trimiterea email). */
export function shouldEmailNotify(
  settings: TenantClientNotificationSettings,
  event: NotificationEvent,
  role: NotificationRole,
): boolean {
  if (!settings.emailEnabled) return false;
  const block = settings.events[event];
  if (!block?.email) return false;
  return block.roles.includes(role);
}
