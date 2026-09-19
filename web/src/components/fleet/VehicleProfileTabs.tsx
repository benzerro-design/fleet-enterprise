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
import { VehicleEquipmentTab } from "@/components/fleet/VehicleEquipmentTab";
import { VehicleDsrTab } from "@/components/fleet/VehicleDsrTab";
import { VehicleInsuranceTab } from "@/components/fleet/VehicleInsuranceTab";
import { TripsConsumptionView } from "@/components/fleet/TripsConsumptionView";
import { FuelTypeFilter } from "@/components/fleet/FuelTypeFilter";
import type { VehicleRecord } from "@/lib/fleet-api";
import type { CostListPayload, DocumentListPayload, MaintenanceListPayload } from "@/lib/vehicle-detail-server";
import { defaultConsumptionPeriod, type ConsumptionPayload } from "@/lib/consumption-types";
import { parseFuelTypesCsv } from "@/lib/fuel-types";
import {
  fuelCardStatusLabel,
} from "@/lib/fuel-card-providers";
import type {
  MaintenancePlanPayload,
  OdometerReadingsPayload,
  VehicleAcquisitionPayload,
  VehicleCivPayload,
  VehicleEquipmentPayload,
  VehiclePhotosPayload,
  VehicleProfileTab,
} from "@/lib/vehicle-profile-types";
import type { DriverAssignmentRecord } from "@/lib/drivers-api";

const TABS: { id: VehicleProfileTab; label: string }[] = [
  { id: "basic", label: "Basic Info" },
  { id: "advanced", label: "Advanced Infos" },
  { id: "acquisition", label: "Date achiziție" },
  { id: "photos", label: "Fotografii" },
  { id: "equipment", label: "Echipări" },
  { id: "odometer", label: "Odometru" },
  { id: "maintenance_plan", label: "Plan Mentenanță" },
  { id: "dsr", label: "DSR" },
  { id: "insurance", label: "Asigurări" },
  { id: "drivers", label: "Șoferi" },
  { id: "consumption", label: "Consum" },
];

type Props = {
  vehicle: VehicleRecord;
  write: boolean;
  photosWrite?: boolean;
  odometerWrite?: boolean;
  planWrite?: boolean;
  lockClient?: boolean;
  civ: VehicleCivPayload;
  acquisition: VehicleAcquisitionPayload;
  photos: VehiclePhotosPayload;
  equipment: VehicleEquipmentPayload;
  odometer: OdometerReadingsPayload;
  maintenancePlan: MaintenancePlanPayload;
  maintenanceList: MaintenanceListPayload | null;
  documentsList: DocumentListPayload | null;
  costsList: CostListPayload | null;
  driverAssignments: DriverAssignmentRecord[];
  consumption: ConsumptionPayload | null;
  /** true după fetch server (tab=consumption); false = încă nu s-a cerut */
  consumptionRequested?: boolean;
  showAcquisition?: boolean;
  civWrite?: boolean;
};

export function VehicleProfileTabs({
  vehicle,
  write,
  photosWrite,
  odometerWrite,
  planWrite,
  lockClient = false,
  civ,
  acquisition,
  photos,
  equipment,
  odometer,
  maintenancePlan,
  maintenanceList,
  documentsList,
  costsList,
  driverAssignments,
  consumption,
  consumptionRequested = false,
  showAcquisition = true,
  civWrite,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => tab.id !== "acquisition" || showAcquisition),
    [showAcquisition],
  );

  const active = useMemo((): VehicleProfileTab => {
    const t = searchParams.get("tab");
    if (t === "acquisition" && !showAcquisition) return "basic";
    if (
      t === "advanced" ||
      t === "acquisition" ||
      t === "photos" ||
      t === "equipment" ||
      t === "odometer" ||
      t === "basic" ||
      t === "maintenance_plan" ||
      t === "dsr" ||
      t === "insurance" ||
      t === "drivers" ||
      t === "consumption"
    ) {
      return t;
    }
    return "basic";
  }, [searchParams, showAcquisition]);

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
          {visibleTabs.map((tab) => (
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
          <VehicleBasicInfoTab vehicle={vehicle} write={write} lockClient={lockClient} />
        ) : null}
        {active === "advanced" ? (
          <VehicleAdvancedCivTab vehicle={vehicle} write={civWrite ?? write} initial={civ} />
        ) : null}
        {active === "acquisition" ? (
          <VehicleAcquisitionTab vehicleId={vehicle.id} write={write} initial={acquisition} />
        ) : null}
        {active === "photos" ? (
          <VehiclePhotosTab vehicleId={vehicle.id} write={photosWrite ?? write} initial={photos} />
        ) : null}
        {active === "equipment" ? (
          <VehicleEquipmentTab vehicleId={vehicle.id} write={write} initial={equipment} />
        ) : null}
        {active === "odometer" ? (
          <VehicleOdometerTab vehicleId={vehicle.id} write={odometerWrite ?? write} initial={odometer} />
        ) : null}
        {active === "maintenance_plan" ? (
          <VehicleMaintenancePlanTab
            vehicleId={vehicle.id}
            write={planWrite ?? write}
            initial={maintenancePlan}
            highlightItemId={planItemHighlight}
          />
        ) : null}
        {active === "dsr" ? (
          <VehicleDsrTab
            vehicle={vehicle}
            maintenance={maintenanceList}
            equipment={equipment}
            printHref={`/fleet/vehicles/${vehicle.id}/dsr`}
          />
        ) : null}
        {active === "insurance" ? (
          <VehicleInsuranceTab
            vehicleId={vehicle.id}
            documents={documentsList}
            costs={costsList}
            write={write}
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
        {active === "consumption" ? (
          <div className="space-y-6">
            {(vehicle.fuelCardNumber || vehicle.fuelCardProvider) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-300">
                <span className="text-xs uppercase tracking-wide text-zinc-500">Card combustibil</span>
                <p className="mt-1 font-mono text-zinc-100">
                  {vehicle.fuelCardNumber ?? "—"}
                  {vehicle.fuelCardProvider ? ` · ${vehicle.fuelCardProvider}` : ""}
                  {vehicle.fuelCardStatus
                    ? ` · ${fuelCardStatusLabel(vehicle.fuelCardStatus)}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Editare în tab Basic Info. Import tranzacții — fază ulterioară.
                </p>
              </div>
            )}
            <form method="get" className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <input type="hidden" name="tab" value="consumption" />
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-zinc-500">De la</label>
                  <input
                    name="periodFrom"
                    type="date"
                    defaultValue={searchParams.get("periodFrom") ?? defaultConsumptionPeriod().from}
                    className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Până la</label>
                  <input
                    name="periodTo"
                    type="date"
                    defaultValue={searchParams.get("periodTo") ?? defaultConsumptionPeriod().to}
                    className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </div>
                <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
                  Aplică
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Tip energie</label>
                <FuelTypeFilter
                  selected={parseFuelTypesCsv(searchParams.get("fuelTypes") ?? undefined)}
                  compact
                />
              </div>
            </form>
            {consumption ? (
              <TripsConsumptionView data={consumption} />
            ) : consumptionRequested ? (
              <p className="text-sm text-amber-400">Nu am putut încărca consumul pentru acest vehicul.</p>
            ) : (
              <p className="text-sm text-zinc-500">Se încarcă consumul…</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
