import { Suspense } from "react";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SchedulerShell } from "@/components/fleet/scheduler/SchedulerShell";
import type { AppointmentStats } from "@/lib/appointments-api";
import { canWritePartnerOps, getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { parsePartnerSupplierQuery, partnerSupplierSearchParams } from "@/lib/partner-context";
import { primarySupplierMembership } from "@/lib/partner-auth";
import type { SupplierListPayload } from "@/lib/suppliers-api";
import { parseSchedulerInboxParam, parseSchedulerViewParam } from "@/lib/scheduler-deep-link";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

async function loadStats(supplierQuery: ReturnType<typeof parsePartnerSupplierQuery>): Promise<AppointmentStats | null> {
  try {
    const p = partnerSupplierSearchParams(supplierQuery);
    const res = await fleetServerFetch(`/appointments/stats?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as AppointmentStats;
  } catch {
    return null;
  }
}

async function loadAdminSuppliers(): Promise<SupplierListPayload["items"]> {
  try {
    const res = await fleetServerFetch("/suppliers?status=active&pageSize=200");
    if (!res?.ok) return [];
    return ((await res.json()) as SupplierListPayload).items;
  } catch {
    return [];
  }
}

type PageProps = {
  searchParams: Promise<{
    week?: string;
    select?: string;
    view?: string;
    inbox?: string;
    ticket?: string;
    vehicle?: string;
    create?: string;
    supplierId?: string;
    suppliers?: string;
    reg?: string;
    case?: string;
  }>;
};

export default async function PartnerAppointmentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const extraSearch = partnerSupplierSearchParams(supplierQuery).toString();
  const initialViewMode = parseSchedulerViewParam(sp.view);
  const initialInbox = parseSchedulerInboxParam(sp.inbox);

  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const canWrite = adminMode ? false : canWritePartnerOps(auth);

  const [stats, vehicles, adminSuppliers] = await Promise.all([
    loadStats(supplierQuery),
    getVehicleOptions(),
    adminMode ? loadAdminSuppliers() : Promise.resolve([]),
  ]);

  const membership = auth.ok && !adminMode ? primarySupplierMembership(auth.me) : undefined;
  const filteredAdmin =
    supplierQuery.supplierId
      ? adminSuppliers.filter((s) => s.id === supplierQuery.supplierId)
      : supplierQuery.suppliers?.length
        ? adminSuppliers.filter((s) => supplierQuery.suppliers!.includes(s.id))
        : adminSuppliers;

  const suppliers = membership
    ? [
        {
          id: membership.supplierId,
          code: membership.supplierCode,
          legalName: membership.supplierLegalName,
          category: "service_auto" as const,
        },
      ]
    : filteredAdmin.map((s) => ({
        id: s.id,
        code: s.code,
        legalName: s.legalName,
        category: s.category,
      }));

  const vehicleOptions = vehicles.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
  }));

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Portal partener</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Programator</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Programări service — listă + calendar, propunere de slot, validare și altă oră pe{" "}
              {membership?.supplierCode ?? (suppliers.length === 1 ? suppliers[0].code : `${suppliers.length} furnizori`)}.
            </p>
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
              initialInbox={initialInbox}
              initialTicketId={sp.ticket?.trim()}
              initialVehicleId={sp.vehicle?.trim()}
              initialVehicleLabel={sp.reg?.trim()}
              initialServiceCaseId={sp.case?.trim()}
              initialCreate={sp.create === "1"}
              basePath="/fleet/partner/appointments"
              extraSearch={extraSearch || undefined}
              partnerMode
            />
          </Suspense>
        </div>
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
