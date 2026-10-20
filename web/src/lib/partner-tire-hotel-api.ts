import type { VehicleTireSeason } from "@/lib/vehicle-wheels-types";

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
  qrPayload: string;
  intakePhotos: string[];
  intakeTreadNotes: string | null;
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
};

export type TireHotelSearchVehicle = {
  id: string;
  registrationNumber: string;
  sets: TireHotelSearchSet[];
};
