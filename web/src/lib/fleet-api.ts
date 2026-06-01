/** Bază pentru apeluri din browser: proxy Next (trimite cookie-ul httpOnly). */
export const fleetBrowserBase = "/api/fleet";

/** Proxy Next → API Nest pentru curse (fără prefix `/fleet`). */
export const tripsBrowserBase = "/api/trips";

/** Proxy Next → API Nest pentru foi de parcurs / FAZ. */
export const tripSheetsBrowserBase = "/api/trip-sheets";

/** Proxy Next → API Nest pentru mentenanță. */
export const maintenanceBrowserBase = "/api/maintenance";

/** Proxy Next → API Nest pentru costuri. */
export const costsBrowserBase = "/api/costs";

/** Proxy Next → API Nest pentru documente vehicul. */
export const documentsBrowserBase = "/api/documents";

/** Proxy Next → API Nest pentru acțiuni reminder. */
export const remindersBrowserBase = "/api/reminders";

export function fleetJsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export type VehicleRecord = {
  id: string;
  tenantId: string;
  /** Cod client (afișare / filtre). */
  clientId: string;
  clientRefId?: string;
  clientLegalName?: string;
  registrationNumber: string;
  brand: string | null;
  model: string | null;
  type: string;
  vin: string | null;
  status: string;
  odometerKm: number;
  itpExpiresOn: string | null;
  itpStationName: string | null;
  itpReminderOffsetsDays?: number[] | null;
  itpReminderMenuSyncEnabled?: boolean;
  civSeries?: string | null;
  civIssuedOn?: string | null;
  civRarOffice?: string | null;
  civMentions?: string | null;
  civProfile?: Record<string, string | number | null>;
  civImportedFromDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: Array<{
    id: string;
    documentTypeCode: string;
    title: string;
    expiresOn: string | null;
    fileUrl: string | null;
    createdAt: string;
  }>;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdByEmail?: string | null;
  updatedByEmail?: string | null;
};

export type VehicleListPayload = {
  items: VehicleRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export const tenantBrowserBase = "/api/tenant";

export const VEHICLE_TYPES = [
  { value: "car", label: "Autoturism" },
  { value: "van_lt_3_5", label: "Autoutilitară până la 3,5 t" },
  { value: "van_gt_3_5", label: "Autoutilitară peste 3,5 t" },
  { value: "tractor_unit", label: "Cap tractor" },
  { value: "trailer", label: "Remorcă" },
  { value: "semi_trailer", label: "Semiremorcă" },
] as const;

export const VEHICLE_STATUSES = [
  { value: "active", label: "Activ" },
  { value: "inactive", label: "Inactiv" },
  { value: "in_maintenance", label: "În mentenanță" },
  { value: "decommissioned", label: "Scos din uz" },
] as const;

export type VehicleTypeValue = (typeof VEHICLE_TYPES)[number]["value"];
export type VehicleStatusValue = (typeof VEHICLE_STATUSES)[number]["value"];
