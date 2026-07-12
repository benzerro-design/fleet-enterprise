import { Suspense } from "react";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SchedulerKpiStrip } from "@/components/fleet/scheduler/SchedulerKpiStrip";
import { SchedulerShell } from "@/components/fleet/scheduler/SchedulerShell";
import type { AppointmentStats } from "@/lib/appointments-api";
import { canWritePartnerOps, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { primarySupplierMembership } from "@/lib/partner-auth";
import type { SchedulerViewMode } from "@/lib/scheduler-deep-link";
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

type PageProps = {
  searchParams: Promise<{ week?: string; select?: string; view?: string; ticket?: string; vehicle?: string; create?: string }>;
};

export default async function PartnerAppointmentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialViewMode: SchedulerViewMode = sp.view === "bands" ? "bands" : "grid";

  const [auth, stats, vehicles] = await Promise.all([
    getAuthMeResult(),
    loadStats(),
    getVehicleOptions(),
  ]);
  const canWrite = canWritePartnerOps(auth);
  const supplier = auth.ok ? primarySupplierMembership(auth.me) : undefined;

  const suppliers = supplier
    ? [
        {
          id: supplier.supplierId,
          code: supplier.supplierCode,
          legalName: supplier.supplierLegalName,
          category: "service_auto" as const,
        },
      ]
    : [];

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
              <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Portal partener</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Programator</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Programări service — calendar filtrat pe locația dvs. ({supplier?.supplierCode ?? "furnizor"}).
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
