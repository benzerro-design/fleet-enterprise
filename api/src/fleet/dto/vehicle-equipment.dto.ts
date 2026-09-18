export type VehicleEquipmentKind =
  | 'tow_hitch'
  | 'fridge_unit'
  | 'liftgate'
  | 'crane'
  | 'other';

export type CreateVehicleEquipmentDto = {
  kind?: VehicleEquipmentKind;
  label: string;
  serialNumber?: string | null;
  mountedOn?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type PatchVehicleEquipmentDto = Partial<CreateVehicleEquipmentDto> & {
  removedOn?: string | null;
};
