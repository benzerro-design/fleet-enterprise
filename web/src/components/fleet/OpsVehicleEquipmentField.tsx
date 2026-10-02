"use client";

import { useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OpsFormField } from "@/components/fleet/ops-form-primitives";
import { fleetBrowserBase } from "@/lib/fleet-api";
import type { VehicleEquipmentPayload, VehicleEquipmentRecord } from "@/lib/vehicle-equipment-types";
import { vehicleEquipmentKindLabel } from "@/lib/vehicle-equipment-types";

type Props = {
  vehicleId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

/** FLEET-027 — select opțional echipare pe formular document / mentenanță. */
export function OpsVehicleEquipmentField({ vehicleId, value, onChange, disabled }: Props) {
  const [items, setItems] = useState<VehicleEquipmentRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!vehicleId) {
      setItems([]);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/equipment`);
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as VehicleEquipmentPayload;
        if (!cancelled) setItems(j.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  useEffect(() => {
    if (!value) return;
    if (items.length > 0 && !items.some((i) => i.id === value)) {
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-validate when items load
  }, [items, value]);

  if (!vehicleId || items.length === 0) return null;

  return (
    <OpsFormField
      label="Echipare (opțional)"
      hint="Leagă documentul / intervenția de o echipare montată pe vehicul."
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={OPS_INPUT_CLASS}
      >
        <option value="">— Vehicul (fără echipare) —</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} ({vehicleEquipmentKindLabel(item.kind)})
            {!item.isActive ? " · demontată" : ""}
          </option>
        ))}
      </select>
    </OpsFormField>
  );
}
