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
  vehicles: OpsVehicleOption[];
  defaultVehicleId?: string;
  children: ReactNode;
};

export function OpsFormModuleHeader({ module, formTitle }: { module: OpsFormModuleKey; formTitle: string }) {
  const accent = OPS_SECTION_ACCENT[module];
  return (
    <div className="mb-6 flex items-center gap-2.5">
      <span className={`h-5 w-1 shrink-0 rounded-sm ${accent.bar}`} aria-hidden />
      <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
        {OPS_FORM_SECTION_LABELS[module]} — {formTitle}
      </h2>
    </div>
  );
}

export function OpsFormLayout({ module, formTitle, vehicles, defaultVehicleId, children }: Props) {
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? vehicles[0]?.id ?? "");

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId],
  );

  const ctx = useMemo(
    () => ({
      vehicleId,
      setVehicleId,
      vehicles,
      selectedVehicle,
      embedded: true,
    }),
    [vehicleId, vehicles, selectedVehicle],
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
          />
        </aside>
        <div className="min-w-0 flex-1 lg:w-[60%]">
          <OpsFormModuleHeader module={module} formTitle={formTitle} />
          {children}
        </div>
      </div>
    </OpsFormProvider>
  );
}
