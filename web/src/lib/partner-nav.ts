export type PartnerNavItem = {
  label: string;
  href: string;
  activePrefixes: string[];
  badge?: number;
};

export const PARTNER_NAV_ITEMS: PartnerNavItem[] = [
  {
    label: "Dashboard",
    href: "/fleet/partner",
    activePrefixes: ["/fleet/partner"],
  },
  {
    label: "Devize & comenzi",
    href: "/fleet/partner/work-orders",
    activePrefixes: ["/fleet/partner/work-orders"],
  },
  {
    label: "Programator",
    href: "/fleet/partner/appointments",
    activePrefixes: ["/fleet/partner/appointments"],
  },
  {
    label: "Scorecard",
    href: "/fleet/partner/scorecard",
    activePrefixes: ["/fleet/partner/scorecard"],
  },
  {
    label: "Rapoarte",
    href: "/fleet/partner/reports",
    activePrefixes: ["/fleet/partner/reports"],
  },
  {
    label: "Profil firmă",
    href: "/fleet/partner/profile",
    activePrefixes: ["/fleet/partner/profile"],
  },
];

/** Bottom bar mobil — max 4 taburi; restul din meniul lateral. */
export const PARTNER_MOBILE_TAB_ITEMS: PartnerNavItem[] = [
  PARTNER_NAV_ITEMS[0],
  PARTNER_NAV_ITEMS[1],
  PARTNER_NAV_ITEMS[2],
  PARTNER_NAV_ITEMS[5],
];

export function partnerNavActive(pathname: string, prefixes: string[]): boolean {
  if (prefixes.some((p) => p === "/fleet/partner")) {
    return pathname === "/fleet/partner" || pathname === "/fleet/partner/";
  }
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
