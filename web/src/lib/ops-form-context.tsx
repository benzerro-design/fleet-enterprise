"use client";

import { createContext, useContext, type ReactNode } from "react";

export type OpsVehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
  odometerKm?: number;
  fuelType?: string | null;
  civProfile?: Record<string, string | number | null>;
};

type OpsFormContextValue = {
  vehicleId: string;
  setVehicleId: (id: string) => void;
  vehicles: OpsVehicleOption[];
  selectedVehicle: OpsVehicleOption | undefined;
  embedded: boolean;
  vehicleLocked: boolean;
};

const OpsFormContext = createContext<OpsFormContextValue | null>(null);

export function OpsFormProvider({
  value,
  children,
}: {
  value: OpsFormContextValue;
  children: ReactNode;
}) {
  return <OpsFormContext.Provider value={value}>{children}</OpsFormContext.Provider>;
}

export function useOpsFormContext(): OpsFormContextValue | null {
  return useContext(OpsFormContext);
}

/** Legătură vehicul: în layout ops folosește contextul din stânga; altfel state local. */
export function useOpsFormVehicleBinding(local: {
  vehicleId: string;
  selectedVehicle: OpsVehicleOption | null | undefined;
}) {
  const ctx = useOpsFormContext();
  const embedded = Boolean(ctx?.embedded);
  return {
    embedded,
    vehicleLocked: ctx?.vehicleLocked ?? false,
    vehicleId: embedded && ctx ? ctx.vehicleId : local.vehicleId,
    selectedVehicle: embedded && ctx ? ctx.selectedVehicle : local.selectedVehicle,
    formClassName: embedded ? "space-y-6" : "mx-auto max-w-xl space-y-6",
  };
}
