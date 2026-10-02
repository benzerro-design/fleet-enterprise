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
  /** Context label: intervenție / cost / document */
  subject?: "intervenție" | "cost" | "document";
};

/**
 * FLEET-027 — atribuire profesională: Autovehicul (implicit) sau Echipare montată.
 */
export function OpsVehicleEquipmentField({
  vehicleId,
  value,
  onChange,
  disabled,
  subject = "intervenție",
}: Props) {
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

  const scope: "vehicle" | "equipment" = value ? "equipment" : "vehicle";

  return (
    <OpsFormField
      label="Atribuit la"
      hint={`Consemnează dacă ${subject === "cost" ? "costul" : subject === "document" ? "documentul" : "intervenția"} privește autovehiculul sau o echipare montată pe el.`}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
            className={
              scope === "vehicle"
                ? "rounded-lg border border-emerald-700/70 bg-emerald-950/40 px-3 py-1.5 text-sm font-medium text-emerald-200"
                : "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
            }
          >
            Autovehicul
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!value && items[0]) onChange(items[0].id);
            }}
            className={
              scope === "equipment"
                ? "rounded-lg border border-sky-700/70 bg-sky-950/40 px-3 py-1.5 text-sm font-medium text-sky-200"
                : "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
            }
          >
            Echipare
          </button>
        </div>
        {scope === "equipment" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={OPS_INPUT_CLASS}
          >
            <option value="" disabled>
              Selectează echiparea…
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({vehicleEquipmentKindLabel(item.kind)})
                {!item.isActive ? " · demontată" : ""}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-zinc-500">Înregistrarea rămâne pe autovehicul (fără echipare).</p>
        )}
      </div>
    </OpsFormField>
  );
}
