/**
 * PLAT-007 — favorite rute în top bar (localStorage per browser).
 */

export type FleetNavFavorite = {
  href: string;
  label: string;
};

export const FLEET_NAV_FAVORITES_KEY = "fleet-nav-favorites-v1";

export const DEFAULT_FLEET_NAV_FAVORITES: FleetNavFavorite[] = [
  { label: "Tichete", href: "/fleet/tickets" },
  { label: "Programator", href: "/fleet/scheduler" },
  { label: "Devize", href: "/fleet/work-orders" },
];

export const FLEET_NAV_FAVORITES_MAX = 5;

export function parseFleetNavFavorites(raw: unknown): FleetNavFavorite[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FleetNavFavorite[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Partial<FleetNavFavorite>;
    if (typeof o.href !== "string" || typeof o.label !== "string") continue;
    const href = o.href.trim();
    const label = o.label.trim();
    if (!href.startsWith("/fleet") || !label) continue;
    if (out.some((f) => f.href === href)) continue;
    out.push({ href, label });
    if (out.length >= FLEET_NAV_FAVORITES_MAX) break;
  }
  return out;
}

export function readFleetNavFavorites(): FleetNavFavorite[] {
  if (typeof window === "undefined") return [...DEFAULT_FLEET_NAV_FAVORITES];
  try {
    const raw = localStorage.getItem(FLEET_NAV_FAVORITES_KEY);
    if (!raw) return [...DEFAULT_FLEET_NAV_FAVORITES];
    const parsed = parseFleetNavFavorites(JSON.parse(raw));
    return parsed && parsed.length > 0 ? parsed : [...DEFAULT_FLEET_NAV_FAVORITES];
  } catch {
    return [...DEFAULT_FLEET_NAV_FAVORITES];
  }
}

export function writeFleetNavFavorites(items: FleetNavFavorite[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      FLEET_NAV_FAVORITES_KEY,
      JSON.stringify(items.slice(0, FLEET_NAV_FAVORITES_MAX)),
    );
  } catch {
    /* ignore quota */
  }
}

/** Href canonic pentru favorite (fără query/hash). */
export function favoriteHrefFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/fleet")) return null;
  // Nu favorizăm detaliu [id] — doar liste / hub-uri din nav.
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 3) {
    const maybeId = parts[2]!;
    // UUID-ish or cuid → secret path
    if (/^[0-9a-f-]{8,}$/i.test(maybeId) || maybeId.length > 20) {
      return `/${parts[0]}/${parts[1]}`;
    }
  }
  return pathname.replace(/\/$/, "") || "/fleet";
}
