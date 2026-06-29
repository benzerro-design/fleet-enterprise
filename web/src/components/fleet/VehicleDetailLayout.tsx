import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { VehicleDetailHeader } from "@/components/fleet/VehicleDetailHeader";
import { VehicleDetailSections } from "@/components/fleet/VehicleDetailSections";
import { VehicleProfileTabs } from "@/components/fleet/VehicleProfileTabs";
import type { OpsVehicleOption } from "@/lib/ops-form-context";
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
};

export function VehicleDetailLayout({
  data,
  vehicles,
  editable,
  canWrite,
  canChangeClient = true,
  mediaWrite,
  planWrite,
}: Props) {
  const {
    vehicle,
    maintenanceList,
    costsList,
    documentsList,
    civPayload,
    acquisitionPayload,
    photosPayload,
    odometerPayload,
    mobilityPayload,
    maintenancePlanPayload,
    driverAssignments,
  } = data;
  const regQs = `registrationNumber=${encodeURIComponent(vehicle.registrationNumber)}`;
  const profileWrite = editable && canWrite;
  const photosWrite = mediaWrite ?? profileWrite;
  const odometerWrite = mediaWrite ?? profileWrite;
  const maintenancePlanWrite = planWrite ?? profileWrite;

  return (
    <FleetPageMain>
        <VehicleDetailHeader
          vehicle={vehicle}
          vehicles={vehicles}
          editable={editable}
          canWrite={canWrite}
          driverAssignments={driverAssignments}
        />

        <Suspense fallback={<p className="mb-10 text-sm text-zinc-500">Se încarcă profilul…</p>}>
          <div className="mb-10">
            <VehicleProfileTabs
              vehicle={vehicle}
              write={profileWrite}
              photosWrite={photosWrite}
              odometerWrite={odometerWrite}
              planWrite={maintenancePlanWrite}
              lockClient={!canChangeClient}
              civ={civPayload}
              acquisition={acquisitionPayload}
              photos={photosPayload}
              odometer={odometerPayload}
              maintenancePlan={maintenancePlanPayload}
              driverAssignments={driverAssignments}
            />
          </div>
        </Suspense>

        <VehicleDetailSections
          vehicleId={vehicle.id}
          registrationNumber={vehicle.registrationNumber}
          write={profileWrite}
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
          mobility={
            mobilityPayload ? { ok: true, data: mobilityPayload } : { ok: false }
          }
        />
    </FleetPageMain>
  );
}
