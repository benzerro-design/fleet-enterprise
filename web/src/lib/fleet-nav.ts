/**
 * Variant C — grouped sidebar IA (single source of truth).
 * live = routable today · phase1/2/later = shown disabled with badge until module ships.
 */

export type NavPhase = "live" | "phase1" | "phase2" | "later";

export type FleetNavLink = {
  kind: "link";
  label: string;
  href: string;
  phase: "live";
  /** Highlight when pathname starts with any of these (defaults to [href]). */
  activePrefixes?: string[];
  adminOnly?: boolean;
  requireAuth?: boolean;
};

export type FleetNavSoon = {
  kind: "soon";
  label: string;
  phase: Exclude<NavPhase, "live">;
  hint?: string;
};

export type FleetNavEntry = FleetNavLink | FleetNavSoon;

export type FleetNavGroup = {
  id: string;
  label: string;
  items: FleetNavEntry[];
  footer?: boolean;
};

export type FleetNavContext = {
  canWrite: boolean;
  authenticated: boolean;
  /** Tenant demo — afișează meniul BOT (doar non-prod / BOT_ENABLED). */
  demoBot?: boolean;
  /** Șofer client — flotă redusă (vehicule alocate). */
  clientDriverPortal?: boolean;
  /** Manager/dispecer client — flotă scoped, fără panou/admin. */
  clientFleetPortal?: boolean;
};

/** Primary groups (scrollable). */
export const FLEET_NAV_GROUPS: FleetNavGroup[] = [
  {
    id: "operations",
    label: "Flotă & operațiuni",
    items: [
      {
        kind: "link",
        label: "Panou general",
        href: "/fleet/dashboard",
        phase: "live",
        activePrefixes: ["/fleet/dashboard"],
      },
      {
        kind: "link",
        label: "Vehicule",
        href: "/fleet/vehicles",
        phase: "live",
        activePrefixes: ["/fleet/vehicles"],
      },
      { kind: "soon", label: "Tracking / Hartă", phase: "phase1" },
      {
        kind: "link",
        label: "Curse & parcurs",
        href: "/fleet/trips",
        phase: "live",
        activePrefixes: ["/fleet/trips"],
      },
      {
        kind: "link",
        label: "Documente flotă",
        href: "/fleet/documents",
        phase: "live",
        activePrefixes: ["/fleet/documents"],
      },
      {
        kind: "link",
        label: "Remindere",
        href: "/fleet/reminders",
        phase: "live",
        activePrefixes: ["/fleet/reminders"],
      },
      {
        kind: "link",
        label: "Mentenanță",
        href: "/fleet/maintenance",
        phase: "live",
        activePrefixes: ["/fleet/maintenance"],
      },
      {
        kind: "link",
        label: "Costuri operaționale",
        href: "/fleet/costs",
        phase: "live",
        activePrefixes: ["/fleet/costs"],
      },
    ],
  },
  {
    id: "clients",
    label: "Clienți & CRM",
    items: [
      {
        kind: "link",
        label: "Clienți (organizații)",
        href: "/fleet/clients",
        phase: "live",
        activePrefixes: ["/fleet/clients"],
      },
      {
        kind: "link",
        label: "Șoferi & utilizatori",
        href: "/fleet/drivers",
        phase: "live",
        activePrefixes: ["/fleet/drivers"],
      },
      {
        kind: "link",
        label: "Tichete CRM",
        href: "/fleet/tickets",
        phase: "live",
        activePrefixes: ["/fleet/tickets"],
      },
      { kind: "soon", label: "Contracte / SLA", phase: "later" },
    ],
  },
  {
    id: "suppliers",
    label: "Furnizori",
    items: [
      { kind: "soon", label: "Furnizori", phase: "phase1" },
      { kind: "soon", label: "Portal furnizori", phase: "phase1" },
      { kind: "soon", label: "Devize & comenzi", phase: "later" },
    ],
  },
  {
    id: "finance",
    label: "Financiar",
    items: [
      { kind: "soon", label: "Facturi & plăți", phase: "later" },
      { kind: "soon", label: "Rapoarte financiare", phase: "later" },
      { kind: "soon", label: "Export contabilitate", phase: "later" },
    ],
  },
  {
    id: "compliance",
    label: "Conformitate",
    items: [
      { kind: "soon", label: "Asistență rutieră", phase: "phase2" },
      { kind: "soon", label: "Vignete / eTransport", phase: "phase2" },
      { kind: "soon", label: "RAR / DRPCIV", phase: "phase2" },
    ],
  },
];

export const FLEET_NAV_BOT_GROUP: FleetNavGroup = {
  id: "bot",
  label: "BOT",
  footer: true,
  items: [
    {
      kind: "link",
      label: "Date",
      href: "/fleet/bot/date",
      phase: "live",
      adminOnly: true,
      activePrefixes: ["/fleet/bot/date"],
    },
    {
      kind: "link",
      label: "Raportare",
      href: "/fleet/bot/raportare",
      phase: "live",
      adminOnly: true,
      activePrefixes: ["/fleet/bot/raportare"],
    },
  ],
};

export const FLEET_NAV_ADMIN_GROUP: FleetNavGroup = {
  id: "admin",
  label: "Administrare",
  footer: true,
  items: [
    {
      kind: "link",
      label: "Membri & useri client",
      href: "/fleet/members",
      phase: "live",
      adminOnly: true,
      activePrefixes: ["/fleet/members"],
    },
    {
      kind: "link",
      label: "Audit",
      href: "/fleet/audit",
      phase: "live",
      requireAuth: true,
      activePrefixes: ["/fleet/audit"],
    },
    { kind: "soon", label: "Setări tenant", phase: "phase1" },
  ],
};

export type FleetMobileTab = {
  label: string;
  href: string;
  activePrefixes: string[];
  /** Opens full menu drawer instead of navigating. */
  openMenu?: boolean;
};

export const FLEET_MOBILE_TABS: FleetMobileTab[] = [
  {
    label: "Acasă",
    href: "/fleet/dashboard",
    activePrefixes: ["/fleet/dashboard"],
  },
  {
    label: "Vehicule",
    href: "/fleet/vehicles",
    activePrefixes: ["/fleet/vehicles"],
  },
  {
    label: "Curse",
    href: "/fleet/trips",
    activePrefixes: ["/fleet/trips"],
  },
  {
    label: "Remindere",
    href: "/fleet/reminders",
    activePrefixes: ["/fleet/reminders"],
  },
  {
    label: "Mai mult",
    href: "#",
    activePrefixes: [],
    openMenu: true,
  },
];

function filterEntry(entry: FleetNavEntry, ctx: FleetNavContext): FleetNavEntry | null {
  if (entry.kind === "soon") return entry;
  if (entry.adminOnly && !ctx.canWrite) return null;
  if (entry.requireAuth && !ctx.authenticated) return null;
  return entry;
}

function filterGroup(group: FleetNavGroup, ctx: FleetNavContext): FleetNavGroup | null {
  if (ctx.clientDriverPortal) {
    if (group.id === "clients") {
      const items = group.items.filter(
        (e) => e.kind === "link" && e.href === "/fleet/tickets",
      );
      if (items.length === 0) return null;
      return { ...group, label: "Solicitări", items };
    }
    if (group.id === "operations") {
      const items = group.items.filter(
        (e) => e.kind === "link" && e.href !== "/fleet/dashboard",
      );
      if (items.length === 0) return null;
      return { ...group, items };
    }
    return null;
  }

  if (ctx.clientFleetPortal && group.id === "admin") return null;

  const items = group.items.map((e) => filterEntry(e, ctx)).filter((e): e is FleetNavEntry => e !== null);
  if (items.length === 0) return null;
  return { ...group, items };
}

export function getFleetNavForUser(ctx: FleetNavContext): {
  groups: FleetNavGroup[];
  admin: FleetNavGroup | null;
  bot: FleetNavGroup | null;
} {
  const groups = FLEET_NAV_GROUPS.map((g) => filterGroup(g, ctx)).filter((g): g is FleetNavGroup => g !== null);
  const admin = filterGroup(FLEET_NAV_ADMIN_GROUP, ctx);
  const bot = ctx.demoBot ? filterGroup(FLEET_NAV_BOT_GROUP, ctx) : null;
  return { groups, admin, bot };
}

export function navEntryIsActive(pathname: string, entry: FleetNavLink): boolean {
  const prefixes = entry.activePrefixes ?? [entry.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function phaseBadgeLabel(phase: Exclude<NavPhase, "live">): string {
  switch (phase) {
    case "phase1":
      return "F1";
    case "phase2":
      return "F2";
    default:
      return "·";
  }
}
