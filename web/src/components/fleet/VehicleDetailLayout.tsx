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
};

export function VehicleDetailLayout({ data, vehicles, editable, canWrite }: Props) {
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
  } = data;
  const regQs = `registrationNumber=${encodeURIComponent(vehicle.registrationNumber)}`;
  const profileWrite = editable && canWrite;

  return (
    <FleetPageMain>
        <VehicleDetailHeader
          vehicle={vehicle}
          vehicles={vehicles}
          editable={editable}
          canWrite={canWrite}
        />

        <Suspense fallback={<p className="mb-10 text-sm text-zinc-500">Se încarcă profilul…</p>}>
          <div className="mb-10">
            <VehicleProfileTabs
              vehicle={vehicle}
              write={profileWrite}
              civ={civPayload}
              acquisition={acquisitionPayload}
              photos={photosPayload}
              odometer={odometerPayload}
              maintenancePlan={maintenancePlanPayload}
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
