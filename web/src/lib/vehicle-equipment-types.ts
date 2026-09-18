export type VehicleEquipmentKind =
  | "tow_hitch"
  | "fridge_unit"
  | "liftgate"
  | "crane"
  | "other";

export const VEHICLE_EQUIPMENT_KINDS: { value: VehicleEquipmentKind; label: string }[] = [
  { value: "tow_hitch", label: "Cârlig remorcare" },
  { value: "fridge_unit", label: "Agregat frig" },
  { value: "liftgate", label: "Ușă lift" },
  { value: "crane", label: "Macara / braț" },
  { value: "other", label: "Altele" },
];

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

export function vehicleEquipmentKindLabel(kind: VehicleEquipmentKind | string): string {
  return VEHICLE_EQUIPMENT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}
