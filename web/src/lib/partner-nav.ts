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
    label: "Profil firmă",
    href: "/fleet/partner/profile",
    activePrefixes: ["/fleet/partner/profile"],
  },
];

export function partnerNavActive(pathname: string, prefixes: string[]): boolean {
  if (prefixes.some((p) => p === "/fleet/partner")) {
    return pathname === "/fleet/partner" || pathname === "/fleet/partner/";
  }
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
