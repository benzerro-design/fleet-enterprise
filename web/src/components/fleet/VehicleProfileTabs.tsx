"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { VehicleAcquisitionTab } from "@/components/fleet/VehicleAcquisitionTab";
import { VehicleAdvancedCivTab } from "@/components/fleet/VehicleAdvancedCivTab";
import { VehicleBasicInfoTab } from "@/components/fleet/VehicleBasicInfoTab";
import { VehicleDriversPanel } from "@/components/fleet/VehicleDriversPanel";
import { VehicleMaintenancePlanTab } from "@/components/fleet/VehicleMaintenancePlanTab";
import { VehicleOdometerTab } from "@/components/fleet/VehicleOdometerTab";
import { VehiclePhotosTab } from "@/components/fleet/VehiclePhotosTab";
import type { VehicleRecord } from "@/lib/fleet-api";
import type {
  MaintenancePlanPayload,
  OdometerReadingsPayload,
  VehicleAcquisitionPayload,
  VehicleCivPayload,
  VehiclePhotosPayload,
  VehicleProfileTab,
} from "@/lib/vehicle-profile-types";
import type { DriverAssignmentRecord } from "@/lib/drivers-api";

const TABS: { id: VehicleProfileTab; label: string }[] = [
  { id: "basic", label: "Basic Info" },
  { id: "advanced", label: "Advanced Infos" },
  { id: "acquisition", label: "Date achiziție" },
  { id: "photos", label: "Fotografii" },
  { id: "odometer", label: "Odometru" },
  { id: "maintenance_plan", label: "Plan Mentenanță" },
  { id: "drivers", label: "Șoferi" },
];

type Props = {
  vehicle: VehicleRecord;
  write: boolean;
  civ: VehicleCivPayload;
  acquisition: VehicleAcquisitionPayload;
  photos: VehiclePhotosPayload;
  odometer: OdometerReadingsPayload;
  maintenancePlan: MaintenancePlanPayload;
  driverAssignments: DriverAssignmentRecord[];
};

export function VehicleProfileTabs({
  vehicle,
  write,
  civ,
  acquisition,
  photos,
  odometer,
  maintenancePlan,
  driverAssignments,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = useMemo((): VehicleProfileTab => {
    const t = searchParams.get("tab");
    if (
      t === "advanced" ||
      t === "acquisition" ||
      t === "photos" ||
      t === "odometer" ||
      t === "basic" ||
      t === "maintenance_plan" ||
      t === "drivers"
    ) {
      return t;
    }
    return "basic";
  }, [searchParams]);

  const planItemHighlight = searchParams.get("planItem");

  const setTab = useCallback(
    (tab: VehicleProfileTab) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", tab);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`rounded-t-lg border px-4 py-2 text-sm transition-colors ${
                active === tab.id
                  ? "border-zinc-700 border-b-zinc-900 bg-zinc-900 text-emerald-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {active === "basic" ? (
          <VehicleBasicInfoTab vehicle={vehicle} write={write} />
        ) : null}
        {active === "advanced" ? (
          <VehicleAdvancedCivTab vehicle={vehicle} write={write} initial={civ} />
        ) : null}
        {active === "acquisition" ? (
          <VehicleAcquisitionTab vehicleId={vehicle.id} write={write} initial={acquisition} />
        ) : null}
        {active === "photos" ? (
          <VehiclePhotosTab vehicleId={vehicle.id} write={write} initial={photos} />
        ) : null}
        {active === "odometer" ? (
          <VehicleOdometerTab vehicleId={vehicle.id} write={write} initial={odometer} />
        ) : null}
        {active === "maintenance_plan" ? (
          <VehicleMaintenancePlanTab
            vehicleId={vehicle.id}
            write={write}
            initial={maintenancePlan}
            highlightItemId={planItemHighlight}
          />
        ) : null}
        {active === "drivers" ? (
          <VehicleDriversPanel
            vehicleId={vehicle.id}
            clientCode={vehicle.clientId}
            registrationNumber={vehicle.registrationNumber}
            initialAssignments={driverAssignments}
            canWrite={write}
          />
        ) : null}
      </div>
    </section>
  );
}
