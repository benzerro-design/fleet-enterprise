"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useAppearancePrefs } from "@/components/fleet/AppearanceProvider";
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
import { VehicleRsaEnrollmentPanel } from "@/components/fleet/VehicleRsaEnrollmentPanel";
import { VehicleLegislativeKitTab } from "@/components/fleet/VehicleLegislativeKitTab";
import { VehicleDetailSections } from "@/components/fleet/VehicleDetailSections";
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
import type { VehicleLegislativeKitPayload } from "@/lib/vehicle-legislative-kit";
import type { DriverAssignmentRecord } from "@/lib/drivers-api";

/** Top strip: Basic+Advanced merged under Infos (URL still uses tab=basic|advanced). */
type NavTabId = "infos" | Exclude<VehicleProfileTab, "basic" | "advanced">;

const NAV_TABS: { id: NavTabId; label: string }[] = [
  { id: "infos", label: "Infos" },
  { id: "acquisition", label: "Date achiziție" },
  { id: "photos", label: "Fotografii" },
  { id: "equipment", label: "Echipări" },
  { id: "wheels", label: "Roti" },
  { id: "legislative_kit", label: "Kit legislativ" },
  { id: "odometer", label: "Odometru" },
  { id: "maintenance_plan", label: "Plan Mentenanță" },
  { id: "dsr", label: "DSR" },
  { id: "insurance", label: "Asigurări" },
  { id: "rsa", label: "Asistență RSA" },
  { id: "drivers", label: "Șoferi" },
  { id: "consumption", label: "Consum" },
];

const INFOS_SUBTABS: { id: Extract<VehicleProfileTab, "basic" | "advanced">; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "advanced", label: "Advanced" },
];

const DRIVER_HIDDEN_TABS = new Set<VehicleProfileTab>([
  "acquisition",
  "maintenance_plan",
  "dsr",
  "drivers",
  "rsa",
]);

function isInfosContentTab(tab: VehicleProfileTab): boolean {
  return tab === "basic" || tab === "advanced";
}

function navIdForTab(tab: VehicleProfileTab): NavTabId {
  return isInfosContentTab(tab) ? "infos" : (tab as NavTabId);
}

type Props = {
  vehicle: VehicleRecord;
  write: boolean;
  photosWrite?: boolean;
  odometerWrite?: boolean;
  planWrite?: boolean;
  /** Kit legislativ — șofer + manager + admin (ca media) */
  legislativeKitWrite?: boolean;
  lockClient?: boolean;
  driverPortal?: boolean;
  civ: VehicleCivPayload;
  acquisition: VehicleAcquisitionPayload;
  photos: VehiclePhotosPayload;
  equipment: VehicleEquipmentPayload;
  wheels: VehicleWheelsPayload;
  legislativeKit: VehicleLegislativeKitPayload;
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
  /** Șofer: accordion operațiuni doar pe Basic Info */
  opsSections?: {
    vehicleId: string;
    registrationNumber: string;
    write: boolean;
    regQs: string;
    maintenance: Parameters<typeof VehicleDetailSections>[0]["maintenance"];
    costs: Parameters<typeof VehicleDetailSections>[0]["costs"];
    documents: Parameters<typeof VehicleDetailSections>[0]["documents"];
    mobility: Parameters<typeof VehicleDetailSections>[0]["mobility"];
  };
};

export function VehicleProfileTabs({
  vehicle,
  write,
  photosWrite,
  odometerWrite,
  planWrite,
  legislativeKitWrite,
  lockClient = false,
  driverPortal = false,
  civ,
  acquisition,
  photos,
  equipment,
  wheels,
  legislativeKit,
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
  opsSections,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { prefs } = useAppearancePrefs();
  const segmented = prefs.profileNav === "segmented";
  const visibleNavTabs = useMemo(
    () =>
      NAV_TABS.filter((tab) => {
        if (tab.id === "acquisition" && !showAcquisition) return false;
        if (
          driverPortal &&
          tab.id !== "infos" &&
          DRIVER_HIDDEN_TABS.has(tab.id as VehicleProfileTab)
        ) {
          return false;
        }
        return true;
      }),
    [showAcquisition, driverPortal],
  );

  const active = useMemo((): VehicleProfileTab => {
    const t = searchParams.get("tab");
    if (t === "infos") return "basic";
    if (t === "acquisition" && !showAcquisition) return "basic";
    if (driverPortal && t && DRIVER_HIDDEN_TABS.has(t as VehicleProfileTab)) return "basic";
    if (
      t === "advanced" ||
      t === "acquisition" ||
      t === "photos" ||
      t === "equipment" ||
      t === "wheels" ||
      t === "legislative_kit" ||
      t === "odometer" ||
      t === "basic" ||
      t === "maintenance_plan" ||
      t === "dsr" ||
      t === "insurance" ||
      t === "rsa" ||
      t === "drivers" ||
      t === "consumption"
    ) {
      return t;
    }
    return "basic";
  }, [searchParams, showAcquisition, driverPortal]);

  const activeNav = navIdForTab(active);
  const planItemHighlight = searchParams.get("planItem");

  const setTab = useCallback(
    (tab: VehicleProfileTab) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", tab);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const selectNav = useCallback(
    (id: NavTabId) => {
      if (id === "infos") {
        if (!isInfosContentTab(active)) setTab("basic");
        return;
      }
      setTab(id);
    },
    [active, setTab],
  );

  const tabBtnClass = (selected: boolean) =>
    segmented
      ? `rounded-lg px-3.5 py-2 text-sm transition-colors ${
          selected
            ? "bg-zinc-900 text-emerald-300 shadow-sm ring-1 ring-zinc-700/80"
            : "text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-200"
        }`
      : `rounded-t-lg border px-4 py-2 text-sm transition-colors ${
          selected
            ? "border-zinc-700 border-b-zinc-900 bg-zinc-900 text-emerald-300"
            : "border-transparent text-zinc-500 hover:text-zinc-200"
        }`;

  const navStrip = (
    <div
      className={
        segmented
          ? "flex flex-wrap gap-1 rounded-xl bg-zinc-800/55 p-1"
          : "flex flex-wrap gap-2"
      }
    >
      {visibleNavTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => selectNav(tab.id)}
          className={tabBtnClass(activeNav === tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/50 ${driverPortal ? "min-w-0 overflow-x-hidden" : ""}`}>
      <div
        className={
          segmented
            ? "border-b border-zinc-800 px-3 py-3 sm:px-4"
            : "border-b border-zinc-800 px-3 pt-3 sm:px-4 sm:pt-4"
        }
      >
        {driverPortal ? (
          <>
            <div className="lg:hidden">
              <DriverMobileTabStrip
                items={visibleNavTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                activeId={activeNav}
                onSelect={(id) => selectNav(id as NavTabId)}
              />
            </div>
            <div className="hidden lg:block">{navStrip}</div>
          </>
        ) : (
          navStrip
        )}
      </div>

      <div className={driverPortal ? "p-4 sm:p-6" : "p-6"}>
        {isInfosContentTab(active) ? (
          <div className="space-y-5">
            <div
              className="-mx-1 flex gap-5 border-b border-zinc-800 px-1"
              role="tablist"
              aria-label="Infos"
            >
              {INFOS_SUBTABS.map((sub) => {
                const selected = active === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(sub.id)}
                    className={`-mb-px border-b-2 pb-2.5 text-sm transition-colors ${
                      selected
                        ? "border-emerald-400 font-medium text-zinc-100"
                        : "border-transparent text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
            {active === "basic" ? (
              <>
                <VehicleBasicInfoTab vehicle={vehicle} write={write} lockClient={lockClient} />
                {driverPortal && opsSections ? (
                  <VehicleDetailSections
                    vehicleId={opsSections.vehicleId}
                    registrationNumber={opsSections.registrationNumber}
                    write={opsSections.write}
                    driverPortal
                    regQs={opsSections.regQs}
                    maintenance={opsSections.maintenance}
                    costs={opsSections.costs}
                    documents={opsSections.documents}
                    mobility={opsSections.mobility}
                  />
                ) : null}
              </>
            ) : (
              <VehicleAdvancedCivTab vehicle={vehicle} write={civWrite ?? write} initial={civ} />
            )}
          </div>
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
            punctureKitPresent={legislativeKit.kit.punctureKitPresent}
          />
        ) : null}
        {active === "legislative_kit" ? (
          <VehicleLegislativeKitTab
            vehicleId={vehicle.id}
            write={legislativeKitWrite ?? write}
            initial={legislativeKit}
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
        {active === "rsa" ? (
          <VehicleRsaEnrollmentPanel vehicleId={vehicle.id} canWrite={write} />
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
                  Editare în Infos → Basic Info. Import tranzacții — fază ulterioară.
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
