/** Temă accordion operațiuni — aliniată cu VehicleDetailSections (detaliu vehicul). */

export type OpsFormModuleKey = "maintenance" | "costs" | "documents" | "reminders" | "trips";

/** Ordine accordion: mentenanță → costuri → documente → remindere → curse */
export const OPS_FORM_MODULE_ORDER: OpsFormModuleKey[] = [
  "maintenance",
  "costs",
  "documents",
  "reminders",
  "trips",
];

export const OPS_FORM_MODULE_LABELS: Record<OpsFormModuleKey, string> = {
  maintenance: "Mentenanță",
  costs: "Costuri",
  documents: "Documente",
  reminders: "Remindere",
  trips: "Curse",
};

export const OPS_FORM_SECTION_LABELS: Record<OpsFormModuleKey, string> = {
  maintenance: "Mentenanță",
  costs: "Costuri operaționale",
  documents: "Documente flotă",
  reminders: "Remindere",
  trips: "Curse & parcurs",
};

export type OpsSectionAccent = { bar: string; badge: string; ring: string };

export const OPS_SECTION_ACCENT: Record<OpsFormModuleKey, OpsSectionAccent> = {
  maintenance: {
    bar: "bg-emerald-500/80",
    badge: "border-emerald-900/50 bg-emerald-950/40 text-emerald-300/90",
    ring: "focus-visible:ring-emerald-500/40",
  },
  costs: {
    bar: "bg-sky-500/80",
    badge: "border-sky-900/50 bg-sky-950/40 text-sky-300/90",
    ring: "focus-visible:ring-sky-500/40",
  },
  documents: {
    bar: "bg-violet-500/80",
    badge: "border-violet-900/50 bg-violet-950/40 text-violet-300/90",
    ring: "focus-visible:ring-violet-500/40",
  },
  reminders: {
    bar: "bg-fuchsia-500/80",
    badge: "border-fuchsia-900/50 bg-fuchsia-950/40 text-fuchsia-300/90",
    ring: "focus-visible:ring-fuchsia-500/40",
  },
  trips: {
    bar: "bg-amber-500/80",
    badge: "border-amber-900/50 bg-amber-950/40 text-amber-300/90",
    ring: "focus-visible:ring-amber-500/40",
  },
};

export const BRIEF_MODULE_HEADERS: Record<OpsFormModuleKey, string[]> = {
  maintenance: ["Data", "Titlu", "Furnizor", "Cost"],
  costs: ["Data", "Cat.", "Sumă", "Furnizor"],
  documents: ["Titlu", "Tip", "Expiră"],
  reminders: ["Titlu", "Scadență", "Km"],
  trips: ["Data", "Traseu", "Km"],
};

export const DEFAULT_BRIEF_LIMIT = 8;

export const BRIEF_LIMIT_OPTIONS = [
  { value: "5", label: "5" },
  { value: "8", label: "8" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "all", label: "Toate" },
] as const;

export function readBriefLimit(module: OpsFormModuleKey): string {
  if (typeof window === "undefined") return String(DEFAULT_BRIEF_LIMIT);
  try {
    const raw = localStorage.getItem(`fleet-brief-limit:${module}`);
    if (raw && BRIEF_LIMIT_OPTIONS.some((o) => o.value === raw)) return raw;
  } catch {
    /* ignore */
  }
  return String(DEFAULT_BRIEF_LIMIT);
}

export function writeBriefLimit(module: OpsFormModuleKey, value: string): void {
  try {
    localStorage.setItem(`fleet-brief-limit:${module}`, value);
  } catch {
    /* ignore */
  }
}
