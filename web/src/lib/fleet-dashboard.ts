export type FleetDashboardSnapshot = {
  generatedAt: string;
  currentMonth: { from: string; to: string };
  kpis: {
    vehiclesActive: number;
    vehiclesTotal: number;
    itpWithin30Days: number;
    itpWithin60Days: number;
    documentsExpired: number;
    documentsExpiringSoon: number;
    remindersNeedingAction: number;
    remindersOverdue: number;
    remindersActive: number;
    costsCurrentMonthCents: number;
    tripsCurrentMonth: number;
  };
  links: {
    vehiclesActive: string;
    itpWithin30Days: string;
    itpWithin60Days: string;
    documentsExpired: string;
    documentsExpiringSoon: string;
    remindersNeedingAction: string;
    remindersOverdue: string;
    costsCurrentMonth: string;
    tripsCurrentMonth: string;
  };
  itpSoon: Array<{
    vehicleId: string;
    registrationNumber: string;
    clientId: string;
    itpExpiresOn: string;
    daysUntilExpiry: number;
  }>;
  remindersDue: Array<{
    id: string;
    title: string;
    vehicleId: string;
    registrationNumber: string;
    clientId: string;
    status: string;
    dueOn: string | null;
  }>;
};

export type DashboardKpiCard = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  href: string;
  tone?: "neutral" | "warn" | "danger";
};

export function buildDashboardKpiCards(data: FleetDashboardSnapshot): DashboardKpiCard[] {
  const { kpis, links } = data;
  return [
    {
      key: "vehicles",
      label: "Vehicule active",
      value: String(kpis.vehiclesActive),
      hint: `din ${kpis.vehiclesTotal} total`,
      href: links.vehiclesActive,
      tone: "neutral",
    },
    {
      key: "itp30",
      label: "ITP în 30 zile",
      value: String(kpis.itpWithin30Days),
      href: links.itpWithin30Days,
      tone: kpis.itpWithin30Days > 0 ? "warn" : "neutral",
    },
    {
      key: "itp60",
      label: "ITP în 60 zile",
      value: String(kpis.itpWithin60Days),
      href: links.itpWithin60Days,
      tone: kpis.itpWithin60Days > 0 ? "warn" : "neutral",
    },
    {
      key: "remindersAction",
      label: "Remindere — acțiune",
      value: String(kpis.remindersNeedingAction),
      hint: `${kpis.remindersActive} active`,
      href: links.remindersNeedingAction,
      tone: kpis.remindersNeedingAction > 0 ? "warn" : "neutral",
    },
    {
      key: "remindersOverdue",
      label: "Remindere — depășite",
      value: String(kpis.remindersOverdue),
      href: links.remindersOverdue,
      tone: kpis.remindersOverdue > 0 ? "danger" : "neutral",
    },
    {
      key: "docsExpired",
      label: "Documente expirate",
      value: String(kpis.documentsExpired),
      href: links.documentsExpired,
      tone: kpis.documentsExpired > 0 ? "danger" : "neutral",
    },
    {
      key: "docsExpiring",
      label: "Documente expiră curând",
      value: String(kpis.documentsExpiringSoon),
      hint: "în 30 zile",
      href: links.documentsExpiringSoon,
      tone: kpis.documentsExpiringSoon > 0 ? "warn" : "neutral",
    },
    {
      key: "costs",
      label: "Costuri luna curentă",
      value: formatRonCompact(kpis.costsCurrentMonthCents),
      href: links.costsCurrentMonth,
      tone: "neutral",
    },
    {
      key: "trips",
      label: "Curse luna curentă",
      value: String(kpis.tripsCurrentMonth),
      href: links.tripsCurrentMonth,
      tone: "neutral",
    },
  ];
}

function formatRonCompact(cents: number): string {
  const ron = cents / 100;
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(ron);
}

export function formatDashboardMonthLabel(from: string): string {
  const d = new Date(`${from}T12:00:00.000Z`);
  return d.toLocaleDateString("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" });
}
