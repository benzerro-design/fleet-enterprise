export type VehicleEquipmentKind = string;

export type CreateVehicleEquipmentDto = {
  label: string;
  kind?: VehicleEquipmentKind;
  serialNumber?: string | null;
  mountedOn?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type PatchVehicleEquipmentDto = {
  label?: string;
  kind?: VehicleEquipmentKind;
  serialNumber?: string | null;
  mountedOn?: string | null;
  removedOn?: string | null;
  notes?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};
