"use client";

import { useMemo, useState, type ReactNode } from "react";
import { VehicleFormBrief } from "@/components/fleet/VehicleFormBrief";
import { OpsFormProvider, type OpsVehicleOption } from "@/lib/ops-form-context";
import {
  OPS_FORM_SECTION_LABELS,
  OPS_SECTION_ACCENT,
  type OpsFormModuleKey,
} from "@/lib/ops-section-theme";

type Props = {
  module: OpsFormModuleKey;
  formTitle: string;
  mode?: "create" | "edit";
  vehicles: OpsVehicleOption[];
  defaultVehicleId?: string;
  children: ReactNode;
};

export function OpsFormModuleHeader({
  module,
  formTitle,
  mode = "create",
}: {
  module: OpsFormModuleKey;
  formTitle: string;
  mode?: "create" | "edit";
}) {
  const accent = OPS_SECTION_ACCENT[module];
  const isEdit = mode === "edit";
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`h-5 w-1 shrink-0 rounded-sm ${accent.bar}`} aria-hidden />
        <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
          {OPS_FORM_SECTION_LABELS[module]} — {formTitle}
        </h2>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
          isEdit
            ? "border-sky-800/60 bg-sky-950/40 text-sky-300/90"
            : "border-zinc-700 bg-zinc-900/60 text-zinc-500"
        }`}
      >
        {isEdit ? "Editare" : "Draft"}
      </span>
    </div>
  );
}

export function OpsFormLayout({ module, formTitle, mode = "create", vehicles, defaultVehicleId, children }: Props) {
  const vehicleLocked = mode === "edit";
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? "");

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId],
  );

  const ctx = useMemo(
    () => ({
      vehicleId,
      setVehicleId: vehicleLocked ? () => {} : setVehicleId,
      vehicles,
      selectedVehicle,
      embedded: true,
      vehicleLocked,
    }),
    [vehicleId, vehicles, selectedVehicle, vehicleLocked],
  );

  return (
    <OpsFormProvider value={ctx}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:w-[40%] lg:max-w-[40%] lg:border-r lg:border-zinc-800/80 lg:pr-5">
          <VehicleFormBrief
            activeModule={module}
            vehicleId={vehicleId}
            onVehicleIdChange={setVehicleId}
            vehicles={vehicles}
            vehicleLocked={vehicleLocked}
          />
        </aside>
        <div className="min-w-0 flex-1 lg:w-[60%]">
          <OpsFormModuleHeader module={module} formTitle={formTitle} mode={mode} />
          {children}
        </div>
      </div>
    </OpsFormProvider>
  );
}
