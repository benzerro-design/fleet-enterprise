import Link from "next/link";
import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { VehicleDetailSections } from "@/components/fleet/VehicleDetailSections";
import { VehicleProfileTabs } from "@/components/fleet/VehicleProfileTabs";
import type { VehicleDetailData } from "@/lib/vehicle-detail-server";

type Props = {
  id: string;
  data: VehicleDetailData;
  /** true = formular editabil + salvare; false = doar vizualizare */
  editable: boolean;
  /** utilizator cu drept de scriere (pentru butoane header) */
  canWrite: boolean;
};

export function VehicleDetailLayout({ id, data, editable, canWrite }: Props) {
  const { vehicle, maintenanceList, costsList, documentsList, civPayload, odometerPayload, mobilityPayload, maintenancePlanPayload } = data;
  const regQs = `registrationNumber=${encodeURIComponent(vehicle.registrationNumber)}`;
  const profileWrite = editable && canWrite;

  return (
    <FleetPageMain>
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Fleet core</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{vehicle.registrationNumber}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Client <span className="font-mono text-zinc-300">{vehicle.clientId}</span> · tenant{" "}
              <span className="font-mono text-zinc-300">{vehicle.tenantId}</span>
              <span className="mx-2 text-zinc-600">·</span>
              <span className="font-mono text-sky-300">{vehicle.odometerKm.toLocaleString("ro-RO")} km</span>
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
                href={`/fleet/vehicles/${id}`}
                className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Vizualizare
              </Link>
            ) : canWrite ? (
              <Link
                href={`/fleet/vehicles/${id}/edit`}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Editare
              </Link>
            ) : null}
          </div>
        </div>

        <Suspense fallback={<p className="mb-10 text-sm text-zinc-500">Se încarcă profilul…</p>}>
          <div className="mb-10">
            <VehicleProfileTabs
              vehicle={vehicle}
              write={profileWrite}
              civ={civPayload}
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
