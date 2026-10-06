"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { DriverMobileTabStrip } from "@/components/fleet/DriverMobileTabStrip";
import { VehicleAcquisitionTab } from "@/components/fleet/VehicleAcquisitionTab";
import { VehicleAdvancedCivTab } from "@/components/fleet/VehicleAdvancedCivTab";
import { VehicleBasicInfoTab } from "@/components/fleet/VehicleBasicInfoTab";
import { VehicleDriversPanel } from "@/components/fleet/VehicleDriversPanel";
import { VehicleMaintenancePlanTab } from "@/components/fleet/VehicleMaintenancePlanTab";
import { VehicleOdometerTab } from "@/components/fleet/VehicleOdometerTab";
import { VehiclePhotosTab } from "@/components/fleet/VehiclePhotosTab";
import { VehicleEquipmentTab } from "@/components/fleet/VehicleEquipmentTab";
import { VehicleWheelsTab } from "@/components/fleet/VehicleWheelsTab";
import { VehicleDsrTab } from "@/components/fleet/VehicleDsrTab";
import { VehicleInsuranceTab } from "@/components/fleet/VehicleInsuranceTab";
import { VehicleFuelLevelPanel } from "@/components/fleet/VehicleFuelLevelPanel";
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
  FuelLevelReadingsPayload,
  VehicleAcquisitionPayload,
  VehicleCivPayload,
  VehicleEquipmentPayload,
  VehiclePhotosPayload,
  VehicleProfileTab,
  VehicleWheelsPayload,
} from "@/lib/vehicle-profile-types";
import type { DriverAssignmentRecord } from "@/lib/drivers-api";

const TABS: { id: VehicleProfileTab; label: string }[] = [
  { id: "basic", label: "Basic Info" },
  { id: "advanced", label: "Advanced Infos" },
  { id: "acquisition", label: "Date achiziție" },
  { id: "photos", label: "Fotografii" },
  { id: "equipment", label: "Echipări" },
  { id: "wheels", label: "Roti" },
  { id: "odometer", label: "Odometru" },
  { id: "maintenance_plan", label: "Plan Mentenanță" },
  { id: "dsr", label: "DSR" },
  { id: "insurance", label: "Asigurări" },
  { id: "drivers", label: "Șoferi" },
  { id: "consumption", label: "Consum" },
];

const DRIVER_HIDDEN_TABS = new Set<VehicleProfileTab>([
  "acquisition",
  "maintenance_plan",
  "dsr",
  "drivers",
]);

type Props = {
  vehicle: VehicleRecord;
  write: boolean;
  photosWrite?: boolean;
  odometerWrite?: boolean;
  planWrite?: boolean;
  lockClient?: boolean;
  driverPortal?: boolean;
  civ: VehicleCivPayload;
  acquisition: VehicleAcquisitionPayload;
  photos: VehiclePhotosPayload;
  equipment: VehicleEquipmentPayload;
  wheels: VehicleWheelsPayload;
  odometer: OdometerReadingsPayload;
  fuelLevel: FuelLevelReadingsPayload;
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
  driverPortal = false,
  civ,
  acquisition,
  photos,
  equipment,
  wheels,
  odometer,
  fuelLevel,
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
    () =>
      TABS.filter((tab) => {
        if (tab.id === "acquisition" && !showAcquisition) return false;
        if (driverPortal && DRIVER_HIDDEN_TABS.has(tab.id)) return false;
        return true;
      }),
    [showAcquisition, driverPortal],
  );

  const active = useMemo((): VehicleProfileTab => {
    const t = searchParams.get("tab");
    if (t === "acquisition" && !showAcquisition) return "basic";
    if (driverPortal && t && DRIVER_HIDDEN_TABS.has(t as VehicleProfileTab)) return "basic";
    if (
      t === "advanced" ||
      t === "acquisition" ||
      t === "photos" ||
      t === "equipment" ||
      t === "wheels" ||
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
  }, [searchParams, showAcquisition, driverPortal]);

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
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/50 ${driverPortal ? "min-w-0 overflow-x-hidden" : ""}`}>
      <div className="border-b border-zinc-800 px-3 pt-3 sm:px-4 sm:pt-4">
        {driverPortal ? (
          <>
            <div className="lg:hidden">
              <DriverMobileTabStrip
                items={visibleTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                activeId={active}
                onSelect={(id) => setTab(id as VehicleProfileTab)}
              />
            </div>
            <div className="hidden flex-wrap gap-2 lg:flex">
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
          </>
        ) : (
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
        )}
      </div>

      <div className={driverPortal ? "p-4 sm:p-6" : "p-6"}>
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
        {active === "wheels" ? (
          <VehicleWheelsTab
            vehicleId={vehicle.id}
            write={write}
            initial={wheels}
            tyresFront={
              civ.civProfile?.tyresFront != null ? String(civ.civProfile.tyresFront) : null
            }
            tyresRear={civ.civProfile?.tyresRear != null ? String(civ.civProfile.tyresRear) : null}
          />
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
            <p className="text-[11px] leading-snug text-zinc-500">
              Analiză consum pe perioadă (L/100km, mix energie, reconciliere). Snapshot-ul de rulaj /
              alimentări recente rămâne pe Overview → accordion{" "}
              <span className="text-zinc-300">Rulaj & alimentări</span>.
            </p>
            <VehicleFuelLevelPanel
              vehicleId={vehicle.id}
              write={odometerWrite ?? write}
              initial={fuelLevel}
            />
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
