/**
 * SETUP-012 — pilonii Setup (tenant / L*).
 * Politicile pe un client anume nu apar aici — se editează pe fișa Clientului.
 */

export type SetupPillarStatus = "live" | "soon";

export type SetupPillar = {
  id: string;
  /** Ruta pagină; null = doar pe landing / nav „în curând”. */
  href: string | null;
  label: string;
  /** Subtitlu scurt pe landing / rail. */
  blurb: string;
  status: SetupPillarStatus;
  /** Prefixuri pentru starea activă în nav / shell. */
  activePrefixes: string[];
};

export const SETUP_PILLARS: SetupPillar[] = [
  {
    id: "clients",
    href: "/fleet/setup/clients",
    label: "Tipuri & servicii",
    blurb: "Catalog tipuri service și șabloane SLA / priorități pe abonat.",
    status: "live",
    activePrefixes: ["/fleet/setup/clients"],
  },
  {
    id: "work-orders",
    href: "/fleet/setup/work-orders",
    label: "Comenzi (WO)",
    blurb: "Recepție, garanții, facturare pe deviz și pași pe dosarul de daună.",
    status: "live",
    activePrefixes: ["/fleet/setup/work-orders"],
  },
  {
    id: "mail",
    href: "/fleet/setup/mail",
    label: "Email",
    blurb: "Expeditor, semnătură și CC pentru trimiterile outbound.",
    status: "live",
    activePrefixes: ["/fleet/setup/mail"],
  },
  {
    id: "integrations",
    href: "/fleet/setup/integrations",
    label: "Integrări",
    blurb: "Import devize, catalog piese și conectori externi.",
    status: "live",
    activePrefixes: ["/fleet/setup/integrations"],
  },
  {
    id: "suppliers",
    href: null,
    label: "Furnizori",
    blurb: "Categorii, documente de onboarding și politici pe axa partener.",
    status: "soon",
    activePrefixes: ["/fleet/setup/suppliers"],
  },
  {
    id: "fleet",
    href: null,
    label: "Flotă & vehicule",
    blurb: "Șabloane de remindere și tipuri implicite — intervalele reale rămân pe vehicul.",
    status: "soon",
    activePrefixes: ["/fleet/setup/fleet"],
  },
  {
    id: "imports",
    href: null,
    label: "Importuri",
    blurb: "Șabloane CSV/XLSX, mapări și cine poate importa în masă.",
    status: "soon",
    activePrefixes: ["/fleet/setup/imports"],
  },
];

export function setupPillarForPath(pathname: string): SetupPillar | null {
  return (
    SETUP_PILLARS.find(
      (p) => p.href && p.activePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
    ) ?? null
  );
}

export function isSetupPillarActive(pathname: string, pillar: SetupPillar): boolean {
  return pillar.activePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
