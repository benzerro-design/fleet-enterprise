import type { VehicleTireSeason } from "@/lib/vehicle-wheels-types";

export type TireHotelStayItem = {
  assetId: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  dot: string | null;
  treadMm: number | null;
  serialOrQr: string | null;
};

export type TireHotelProtocolSummary = {
  kind:
    | "check_in"
    | "check_out"
    | "seasonal"
    | "transfer"
    | "scrap"
    | "leasing_return"
    | "quarantine";
  status: "draft" | "signed" | "voided";
  revision?: number;
  signedAt: string | null;
  pdfSha256: string | null;
};

export type TireHotelStay = {
  id: string;
  setId: string;
  supplierId: string;
  locationCode: string | null;
  bayCode?: string | null;
  binCode?: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  plate: string;
  vehicleId: string;
  clientId?: string | null;
  season: VehicleTireSeason;
  setName: string | null;
  mountedAs?: string | null;
  itemCount?: number;
  items?: TireHotelStayItem[];
  qrPayload: string;
  intakePhotos: string[];
  intakeTreadNotes: string | null;
  feeCents?: number | null;
  contractRef?: string | null;
  accountingNote?: string | null;
  costEntryId?: string | null;
  costAmountCents?: number | null;
  protocols?: TireHotelProtocolSummary[];
  warrantyCertificateUrl?: string | null;
  purchaseDocs?: unknown;
};

export type TireHotelReleaseKind = "at_client" | "in_transit" | "scrap" | "quarantine";

export type TireHotelCapability = {
  hasTireStorage: boolean;
  supplierId: string | null;
  supplierName: string | null;
  transferTargets?: Array<{ id: string; legalName: string }>;
};

export type TireHotelSearchSet = {
  id: string;
  season: VehicleTireSeason;
  name: string | null;
  itemCount: number;
  qrPayload: string;
  hasActiveStayHere: boolean;
  mountedAs?: string | null;
  suggestedFeeCents?: number | null;
  rimInch?: number | null;
  dominantSize?: string | null;
};

export type TireHotelFeeQuote = {
  setId: string;
  supplierId: string;
  feeCents: number | null;
  unitMonthlyPerPieceCents?: number | null;
  pieceCount?: number;
  calendarMonths?: number;
  billingUnit?: "piece";
  billingPeriod?: "calendar_month";
  rimInch: number | null;
  mountedAs: string | null;
  dominantSize: string | null;
};

export type TireHotelSearchVehicle = {
  id: string;
  registrationNumber: string;
  sets: TireHotelSearchSet[];
};
