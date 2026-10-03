import { getHelpArticle, type HelpArticle } from "@/lib/help-articles";

/**
 * PLAT-007 — mapare rută → articol Help pentru rail contextual.
 * Conținutul rămâne HELP-001; rail-ul doar alege ce e relevant pe ecran.
 */
const ROUTE_HELP: Array<{ prefixes: string[]; slug: string }> = [
  { prefixes: ["/fleet/scheduler"], slug: "programari-politici" },
  { prefixes: ["/fleet/tickets", "/fleet/audit"], slug: "programari-proxy-lstar" },
  { prefixes: ["/fleet/members", "/fleet/user-strategy"], slug: "membri-invite" },
  { prefixes: ["/fleet/work-orders"], slug: "repropunere-acelasi-slot" },
  { prefixes: ["/fleet/help"], slug: "help-vs-proceduri" },
  { prefixes: ["/fleet/setup"], slug: "setup-tenant" },
  { prefixes: ["/fleet/clients"], slug: "programari-politici" },
  { prefixes: ["/fleet"], slug: "ierarhie-l-r" },
];

export const FLEET_HELP_RAIL_OPEN_KEY = "fleet-help-rail-open-v1";

export function helpArticleForPath(pathname: string): HelpArticle | null {
  const path = pathname.split("?")[0] ?? pathname;
  for (const row of ROUTE_HELP) {
    if (row.prefixes.some((p) => path === p || path.startsWith(`${p}/`))) {
      return getHelpArticle(row.slug) ?? null;
    }
  }
  return getHelpArticle("ierarhie-l-r") ?? null;
}

export function readHelpRailOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FLEET_HELP_RAIL_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHelpRailOpen(open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FLEET_HELP_RAIL_OPEN_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}
