import type { VehicleEquipmentKind } from './dto/vehicle-equipment.dto';

export type VehicleEquipmentRecord = {
  id: string;
  vehicleId: string;
  kind: VehicleEquipmentKind;
  label: string;
  serialNumber: string | null;
  mountedOn: string | null;
  removedOn: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type VehicleEquipmentPayload = {
  items: VehicleEquipmentRecord[];
};
