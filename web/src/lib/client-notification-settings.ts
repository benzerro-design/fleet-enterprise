/** Aliniat cu api/src/tenant/client-notification-settings.ts (SETUP-006). */

export type NotificationRole = "l1" | "l0" | "l_star";

export type NotificationEvent =
  | "ticket_created"
  | "ticket_status_changed"
  | "ticket_comment"
  | "appointment_proposed"
  | "appointment_confirmed"
  | "appointment_reproposed"
  | "ticket_resolved"
  | "sla_breached";

export type EventChannelSetting = {
  email: boolean;
  roles: NotificationRole[];
};

export type TenantClientNotificationSettings = {
  emailEnabled: boolean;
  events: Record<NotificationEvent, EventChannelSetting>;
};

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  "ticket_created",
  "ticket_status_changed",
  "ticket_comment",
  "appointment_proposed",
  "appointment_confirmed",
  "appointment_reproposed",
  "ticket_resolved",
  "sla_breached",
];

export const NOTIFICATION_ROLES: NotificationRole[] = ["l1", "l0", "l_star"];

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  ticket_created: "Tichet creat",
  ticket_status_changed: "Status tichet schimbat",
  ticket_comment: "Comentariu nou pe tichet",
  appointment_proposed: "Programare propusă",
  appointment_confirmed: "Programare confirmată",
  appointment_reproposed: "Programare repropusă",
  ticket_resolved: "Tichet rezolvat / închis",
  sla_breached: "SLA încălcat / aproape de termen",
};

export const ROLE_LABELS: Record<NotificationRole, string> = {
  l1: "L1 (manager client)",
  l0: "L0 (șofer)",
  l_star: "L* (abonat)",
};

export const DEFAULT_CLIENT_NOTIFICATION_SETTINGS: TenantClientNotificationSettings = {
  emailEnabled: true,
  events: {
    ticket_created: { email: false, roles: ["l1"] },
    ticket_status_changed: { email: false, roles: ["l1"] },
    ticket_comment: { email: false, roles: ["l1"] },
    appointment_proposed: { email: true, roles: ["l1"] },
    appointment_confirmed: { email: true, roles: ["l1", "l0"] },
    appointment_reproposed: { email: true, roles: ["l1"] },
    ticket_resolved: { email: true, roles: ["l1"] },
    sla_breached: { email: true, roles: ["l1", "l_star"] },
  },
};

export function normalizeClientNotificationSettings(
  raw: Partial<TenantClientNotificationSettings> | null | undefined,
): TenantClientNotificationSettings {
  const base = DEFAULT_CLIENT_NOTIFICATION_SETTINGS;
  if (!raw || typeof raw !== "object") {
    return {
      emailEnabled: base.emailEnabled,
      events: Object.fromEntries(
        NOTIFICATION_EVENTS.map((e) => [
          e,
          { email: base.events[e].email, roles: [...base.events[e].roles] },
        ]),
      ) as TenantClientNotificationSettings["events"],
    };
  }
  const events = {} as TenantClientNotificationSettings["events"];
  for (const key of NOTIFICATION_EVENTS) {
    const block = raw.events?.[key];
    const fb = base.events[key];
    const roles = Array.isArray(block?.roles)
      ? block!.roles.filter((r): r is NotificationRole =>
          NOTIFICATION_ROLES.includes(r as NotificationRole),
        )
      : [...fb.roles];
    events[key] = {
      email: typeof block?.email === "boolean" ? block.email : fb.email,
      roles: roles.length > 0 ? roles : [...fb.roles],
    };
  }
  return {
    emailEnabled: typeof raw.emailEnabled === "boolean" ? raw.emailEnabled : base.emailEnabled,
    events,
  };
}
