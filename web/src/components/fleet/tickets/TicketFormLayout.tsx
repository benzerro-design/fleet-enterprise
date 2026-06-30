"use client";

import { useMemo, useState, type ReactNode } from "react";
import { TicketContextBrief } from "@/components/fleet/tickets/TicketContextBrief";
import type { OpsVehicleOption } from "@/lib/ops-form-context";

export type TicketFormLayoutContext = {
  clientId: string;
  setClientId: (id: string) => void;
  vehicleId: string;
  setVehicleId: (id: string) => void;
  driverId: string;
  setDriverId: (id: string) => void;
  selectedVehicle: OpsVehicleOption | undefined;
};

type Props = {
  vehicles: OpsVehicleOption[];
  defaultClientId?: string;
  defaultVehicleId?: string;
  defaultDriverId?: string;
  reminderActionId?: string;
  children: (ctx: TicketFormLayoutContext) => ReactNode;
};

export function TicketFormLayout({
  vehicles,
  defaultClientId = "",
  defaultVehicleId = "",
  defaultDriverId = "",
  reminderActionId,
  children,
}: Props) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [driverId, setDriverId] = useState(defaultDriverId);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId],
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:w-[40%] lg:max-w-[40%] lg:border-r lg:border-zinc-800/80 lg:pr-5">
        <TicketContextBrief
          clientId={clientId}
          vehicleId={vehicleId}
          driverId={driverId}
          vehicles={vehicles}
          reminderActionId={reminderActionId}
          onVehicleIdChange={setVehicleId}
        />
      </aside>
      <div className="min-w-0 flex-1 lg:w-[60%]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Solicitare nouă</h2>
          <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Draft
          </span>
        </div>
        {children({
          clientId,
          setClientId,
          vehicleId,
          setVehicleId,
          driverId,
          setDriverId,
          selectedVehicle,
        })}
      </div>
    </div>
  );
}
