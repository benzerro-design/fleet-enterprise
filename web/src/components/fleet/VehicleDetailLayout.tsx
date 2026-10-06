import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { VehicleDetailHeader } from "@/components/fleet/VehicleDetailHeader";
import { VehicleDetailSections } from "@/components/fleet/VehicleDetailSections";
import { VehicleProfileTabs } from "@/components/fleet/VehicleProfileTabs";
import type { OpsVehicleOption } from "@/lib/ops-form-context";
import type { ConsumptionPayload } from "@/lib/consumption-types";
import type { VehicleDetailData } from "@/lib/vehicle-detail-server";

type Props = {
  data: VehicleDetailData;
  vehicles: OpsVehicleOption[];
  /** true = formular editabil + salvare; false = doar vizualizare */
  editable: boolean;
  /** utilizator cu drept de scriere (pentru butoane header) */
  canWrite: boolean;
  /** false pentru user client — clientul vehiculului nu se schimbă */
  canChangeClient?: boolean;
  /** șofer: scriere doar fotografii + odometru */
  mediaWrite?: boolean;
  /** plan mentenanță — doar manager */
  planWrite?: boolean;
  /** Portal șofer — tab-uri și operațiuni reduse */
  driverPortal?: boolean;
  consumption?: ConsumptionPayload | null;
  consumptionRequested?: boolean;
  showAcquisition?: boolean;
  civWrite?: boolean;
};

export function VehicleDetailLayout({
  data,
  vehicles,
  editable,
  canWrite,
  canChangeClient = true,
  mediaWrite,
  planWrite,
  driverPortal = false,
  consumption = null,
  consumptionRequested = false,
  showAcquisition = false,
  civWrite = false,
}: Props) {
  const {
    vehicle,
    maintenanceList,
    costsList,
    documentsList,
    civPayload,
    acquisitionPayload,
    photosPayload,
    equipmentPayload,
    wheelsPayload,
    legislativeKitPayload,
    odometerPayload,
    fuelLevelPayload,
    mobilityPayload,
    maintenancePlanPayload,
    driverAssignments,
  } = data;
  const regQs = `registrationNumber=${encodeURIComponent(vehicle.registrationNumber)}`;
  const profileWrite = editable && canWrite;
  const photosWrite = mediaWrite ?? profileWrite;
  const odometerWrite = mediaWrite ?? profileWrite;
  const legislativeKitWrite = mediaWrite ?? profileWrite;
  const maintenancePlanWrite = planWrite ?? profileWrite;

  return (
    <FleetPageMain className={driverPortal ? "min-w-0 overflow-x-hidden" : undefined}>
        <VehicleDetailHeader
          vehicle={vehicle}
          vehicles={vehicles}
          editable={editable}
          canWrite={canWrite}
          driverPortal={driverPortal}
          driverAssignments={driverAssignments}
          heroPhotoUrl={
            photosPayload.items.find((p) => p.isHero && p.fileUrl)?.fileUrl ??
            photosPayload.items.find((p) => p.kind === "exterior" && p.fileUrl)?.fileUrl ??
            photosPayload.items.find((p) => p.fileUrl)?.fileUrl ??
            null
          }
        />

      <Suspense fallback={<p className="mb-10 text-sm text-zinc-500">Se încarcă profilul…</p>}>
        <div className="mb-10">
          <VehicleProfileTabs
            vehicle={vehicle}
            write={profileWrite}
            photosWrite={photosWrite}
            odometerWrite={odometerWrite}
            planWrite={maintenancePlanWrite}
            legislativeKitWrite={legislativeKitWrite}
            lockClient={!canChangeClient}
            driverPortal={driverPortal}
            civ={civPayload}
            acquisition={acquisitionPayload}
            photos={photosPayload}
            equipment={equipmentPayload}
            wheels={wheelsPayload}
            legislativeKit={legislativeKitPayload}
            odometer={odometerPayload}
            fuelLevel={fuelLevelPayload}
            maintenancePlan={maintenancePlanPayload}
            maintenanceList={maintenanceList}
            documentsList={documentsList}
            costsList={costsList}
            driverAssignments={driverAssignments}
            consumption={consumption}
            consumptionRequested={consumptionRequested}
            showAcquisition={showAcquisition && !driverPortal}
            civWrite={civWrite}
          />
        </div>
      </Suspense>

      <VehicleDetailSections
        vehicleId={vehicle.id}
        registrationNumber={vehicle.registrationNumber}
        write={profileWrite}
        driverPortal={driverPortal}
        regQs={regQs}
        maintenance={
          maintenanceList
            ? { ok: true, items: maintenanceList.items, total: maintenanceList.total }
            : { ok: false }
        }
        costs={costsList ? { ok: true, items: costsList.items, total: costsList.total } : { ok: false }}
        documents={
          documentsList
            ? { ok: true, items: documentsList.items, total: documentsList.total }
            : { ok: false }
        }
        mobility={mobilityPayload ? { ok: true, data: mobilityPayload } : { ok: false }}
      />
    </FleetPageMain>
  );
}
