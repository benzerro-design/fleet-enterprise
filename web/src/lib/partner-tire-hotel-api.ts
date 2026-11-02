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

export type TireHotelStay = {
  id: string;
  setId: string;
  supplierId: string;
  locationCode: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  plate: string;
  vehicleId: string;
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
};

export type TireHotelCapability = {
  hasTireStorage: boolean;
  supplierId: string | null;
  supplierName: string | null;
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
  rimInch: number | null;
  mountedAs: string | null;
  dominantSize: string | null;
};

export type TireHotelSearchVehicle = {
  id: string;
  registrationNumber: string;
  sets: TireHotelSearchSet[];
};
