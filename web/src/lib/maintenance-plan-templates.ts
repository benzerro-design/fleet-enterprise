import type { MaintenancePlanTriggerMode } from "@/lib/maintenance-plan-types";

export const MAINTENANCE_PLAN_CATEGORIES = [
  "Motor",
  "Transmisie",
  "Frânare",
  "Anvelope",
  "Electric",
  "Caroserie",
  "Revizie generală",
  "Altele",
] as const;

export type MaintenancePlanTemplate = {
  id: string;
  title: string;
  category: (typeof MAINTENANCE_PLAN_CATEGORIES)[number];
  intervalDays: number | null;
  intervalKm: number | null;
  triggerMode: MaintenancePlanTriggerMode;
  notes?: string;
};

/** Șabloane PM inspirate din practici Fleetio / OEM — punct de plecare, ajustabil per vehicul. */
export const MAINTENANCE_PLAN_TEMPLATES: MaintenancePlanTemplate[] = [
  {
    id: "oil-change",
    title: "Schimb ulei motor + filtru",
    category: "Motor",
    intervalDays: 365,
    intervalKm: 15000,
    triggerMode: "whichever_first",
    notes: "Ulei și filtru conform specificații producător.",
  },
  {
    id: "air-filters",
    title: "Filtre aer / polen / ulei",
    category: "Motor",
    intervalDays: 730,
    intervalKm: 30000,
    triggerMode: "whichever_first",
  },
  {
    id: "periodic-service",
    title: "Revizie periodică",
    category: "Revizie generală",
    intervalDays: 365,
    intervalKm: 20000,
    triggerMode: "whichever_first",
  },
  {
    id: "brake-pads",
    title: "Plăcuțe / discuri frână",
    category: "Frânare",
    intervalDays: null,
    intervalKm: 40000,
    triggerMode: "km",
  },
  {
    id: "brake-fluid",
    title: "Lichid de frână",
    category: "Frânare",
    intervalDays: 730,
    intervalKm: 60000,
    triggerMode: "whichever_first",
  },
  {
    id: "tires-season",
    title: "Schimb anvelope sezon",
    category: "Anvelope",
    intervalDays: 180,
    intervalKm: null,
    triggerMode: "time",
  },
  {
    id: "timing-belt",
    title: "Distribuție / curea accesorii",
    category: "Motor",
    intervalDays: 1460,
    intervalKm: 90000,
    triggerMode: "whichever_first",
  },
  {
    id: "ac-service",
    title: "Service climatizare",
    category: "Electric",
    intervalDays: 365,
    intervalKm: null,
    triggerMode: "time",
  },
  {
    id: "battery",
    title: "Verificare / înlocuire baterie",
    category: "Electric",
    intervalDays: 1095,
    intervalKm: null,
    triggerMode: "time",
  },
  {
    id: "low-use-check",
    title: "Verificare vehicul rar utilizat",
    category: "Revizie generală",
    intervalDays: 90,
    intervalKm: null,
    triggerMode: "time",
    notes: "Pentru vehicule sub 500 km/lună — presiune anvelope, baterie, fluid.",
  },
];

export const TRIGGER_MODE_LABELS: Record<MaintenancePlanTriggerMode, string> = {
  time: "Doar timp (calendar)",
  km: "Doar kilometraj",
  whichever_first: "Primul care intervine (timp sau km)",
};
