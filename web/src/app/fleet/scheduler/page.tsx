import { Suspense } from "react";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SchedulerKpiStrip } from "@/components/fleet/scheduler/SchedulerKpiStrip";
import { SchedulerShell } from "@/components/fleet/scheduler/SchedulerShell";
import type { AppointmentStats } from "@/lib/appointments-api";
import { canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { SchedulerViewMode } from "@/lib/scheduler-deep-link";
import type { SupplierListPayload } from "@/lib/suppliers-api";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

async function loadStats(): Promise<AppointmentStats | null> {
  try {
    const res = await fleetServerFetch("/appointments/stats");
    if (!res?.ok) return null;
    return (await res.json()) as AppointmentStats;
  } catch {
    return null;
  }
}

async function loadSuppliers() {
  try {
    const res = await fleetServerFetch("/suppliers?status=active&pageSize=200");
    if (!res?.ok) return [];
    const data = (await res.json()) as SupplierListPayload;
    return data.items.map((s) => ({
      id: s.id,
      code: s.code,
      legalName: s.legalName,
      category: s.category,
      services: s.services ?? [],
    }));
  } catch {
    return [];
  }
}

async function loadServiceTypes() {
  try {
    const res = await fleetServerFetch("/tenant/service-types/active");
    if (!res?.ok) return [];
    const data = (await res.json()) as { items: { id: string; code: string; label: string }[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

type PageProps = {
  searchParams: Promise<{ week?: string; select?: string; view?: string; ticket?: string; vehicle?: string; create?: string }>;
};

export default async function SchedulerPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialViewMode: SchedulerViewMode = sp.view === "bands" ? "bands" : "grid";

  const [auth, stats, suppliers, serviceTypes, vehicles] = await Promise.all([
    getAuthMeResult(),
    loadStats(),
    loadSuppliers(),
    loadServiceTypes(),
    getVehicleOptions(),
  ]);
  const canWrite = canWriteFleetOps(auth);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
  }));

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-sky-400">Clienți & CRM</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Programator</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Programări service — grilă sau benzi furnizor, drag-and-drop reprogramare, legături tichet și WO.
              </p>
            </div>
            <SchedulerKpiStrip stats={stats} />
          </div>
        }
      >
        <div className="flex min-h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
          <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Se încarcă programatorul…</p>}>
            <SchedulerShell
              canWrite={canWrite}
              initialStats={stats}
              suppliers={suppliers}
              serviceTypes={serviceTypes}
              vehicles={vehicleOptions}
              initialWeekIso={sp.week}
              initialSelectId={sp.select}
              initialViewMode={initialViewMode}
              initialTicketId={sp.ticket?.trim()}
              initialVehicleId={sp.vehicle?.trim()}
              initialCreate={sp.create === "1"}
            />
          </Suspense>
        </div>
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
