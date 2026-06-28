"use client";

import Link from "next/link";
import { Suspense } from "react";
import { VehicleSwitcher } from "@/components/fleet/VehicleSwitcher";
import type { OpsVehicleOption } from "@/lib/ops-form-context";
import type { VehicleRecord } from "@/lib/fleet-api";
import type { DriverAssignmentRecord } from "@/lib/drivers-api";

type Props = {
  vehicle: VehicleRecord;
  vehicles: OpsVehicleOption[];
  editable: boolean;
  canWrite: boolean;
  driverAssignments?: DriverAssignmentRecord[];
};

function modelLabel(vehicle: VehicleRecord): string {
  const parts = [vehicle.brand, vehicle.model].filter((x) => x?.trim());
  return parts.length ? parts.join(" ") : "—";
}

function VehicleSwitcherSlot(props: Omit<Props, "editable" | "canWrite"> & { mode: "view" | "edit" }) {
  const { vehicle, vehicles, mode } = props;
  return (
    <VehicleSwitcher
      currentId={vehicle.id}
      currentRegistration={vehicle.registrationNumber}
      currentModelLabel={modelLabel(vehicle)}
      currentOdometerKm={vehicle.odometerKm}
      currentClientId={vehicle.clientId}
      vehicles={vehicles}
      mode={mode}
    />
  );
}

export function VehicleDetailHeader({ vehicle, vehicles, editable, canWrite, driverAssignments = [] }: Props) {
  const mode = editable ? "edit" : "view";
  const activeDriver = driverAssignments.find((a) => !a.unassignedAt) ?? null;

  return (
    <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet core</p>
        <Suspense
          fallback={
            <h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight">{vehicle.registrationNumber}</h1>
          }
        >
          <VehicleSwitcherSlot vehicle={vehicle} vehicles={vehicles} mode={mode} />
        </Suspense>
        <p className="mt-2 text-sm text-zinc-400">
          Client <span className="font-mono text-zinc-300">{vehicle.clientId}</span>
          {vehicle.clientLegalName ? (
            <>
              {" "}
              <span className="text-zinc-500">({vehicle.clientLegalName})</span>
            </>
          ) : null}
          <span className="mx-2 text-zinc-600">·</span>
          tenant <span className="font-mono text-zinc-300">{vehicle.tenantId}</span>
          <span className="mx-2 text-zinc-600">·</span>
          <span className="font-mono text-sky-300">{vehicle.odometerKm.toLocaleString("ro-RO")} km</span>
          {activeDriver ? (
            <>
              <span className="mx-2 text-zinc-600">·</span>
              <span>
                Șofer{" "}
                <Link
                  href={`/fleet/drivers/${activeDriver.driverId}`}
                  className="text-emerald-400 hover:underline"
                >
                  {activeDriver.driverFullName ?? "—"}
                </Link>
              </span>
            </>
          ) : null}
          {editable ? (
            <>
              <span className="mx-2 text-zinc-600">·</span>
              <span className="text-emerald-400/90">Mod editare</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/fleet/vehicles"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la listă
        </Link>
        {editable ? (
          <Link
            href={`/fleet/vehicles/${vehicle.id}`}
            className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Vizualizare
          </Link>
        ) : canWrite ? (
          <>
            <Link
              href={`/fleet/tickets/new?vehicleId=${encodeURIComponent(vehicle.id)}&client=${encodeURIComponent(vehicle.clientId)}`}
              className="inline-flex w-fit items-center justify-center rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950/50"
            >
              Deschide tichet
            </Link>
            <Link
              href={`/fleet/vehicles/${vehicle.id}/edit`}
              className="inline-flex w-fit items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
            >
              Editare
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
