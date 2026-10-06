import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DriverProfileTabs } from "@/components/fleet/DriverProfileTabs";
import { DriverViewportSplit } from "@/components/fleet/DriverViewportSplit";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import type { DriverTripsSearch } from "@/components/fleet/DriverTripsPanel";
import {
  driverIdFromAuth,
  getAuthMeResult,
  isClientDriverPortal,
} from "@/lib/auth-server";
import { documentExpiryBadge } from "@/lib/document-expiry";
import {
  driverStatusLabel,
  type DriverDetailPayload,
  type DriverDocumentRecord,
} from "@/lib/drivers-api";
import { defaultConsumptionPeriod, type ConsumptionPayload } from "@/lib/consumption-types";
import { buildDriverTripsQuery, type DriverTripListPayload } from "@/lib/trips-api";
import { fleetServerFetch } from "@/lib/fleet-server";

async function loadDriver(id: string): Promise<DriverDetailPayload | null> {
  try {
    const res = await fleetServerFetch(`/drivers/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as DriverDetailPayload;
  } catch {
    return null;
  }
}

async function loadDriverDocuments(id: string): Promise<DriverDocumentRecord[]> {
  try {
    const res = await fleetServerFetch(`/drivers/${id}/documents`);
    if (!res?.ok) return [];
    return (await res.json()) as DriverDocumentRecord[];
  } catch {
    return [];
  }
}

async function loadDriverConsumption(
  id: string,
  periodFrom?: string,
  periodTo?: string,
): Promise<ConsumptionPayload | null> {
  const defaults = defaultConsumptionPeriod();
  const from = periodFrom?.trim() || defaults.from;
  const to = periodTo?.trim() || defaults.to;
  try {
    const res = await fleetServerFetch(`/drivers/${id}/consumption?from=${from}&to=${to}`);
    if (!res?.ok) return null;
    return (await res.json()) as ConsumptionPayload;
  } catch {
    return null;
  }
}

async function loadDriverTrips(
  driverId: string,
  search: DriverTripsSearch,
): Promise<DriverTripListPayload | null> {
  try {
    const qs = buildDriverTripsQuery(driverId, {
      page: search.page,
      startedFrom: search.startedFrom,
      startedTo: search.startedTo,
      q: search.q,
      ended: search.ended,
    });
    const res = await fleetServerFetch(`/trips?${qs}`);
    if (!res?.ok) return null;
    return (await res.json()) as DriverTripListPayload;
  } catch {
    return null;
  }
}

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    periodFrom?: string;
    periodTo?: string;
    page?: string;
    startedFrom?: string;
    startedTo?: string;
    q?: string;
    ended?: string;
  }>;
};

export default async function DriverSelfProfilePage({ searchParams }: PageProps) {
  const auth = await getAuthMeResult();
  if (!isClientDriverPortal(auth)) redirect("/fleet/vehicles");
  const id = driverIdFromAuth(auth);
  if (!id) redirect("/fleet/vehicles");

  const sp = await searchParams;
  const showConsumption = sp.tab === "consumption";
  const showDocuments = sp.tab === "documents";
  const showTrips = sp.tab === "trips";
  const tripsSearch: DriverTripsSearch = {
    page: Math.max(1, parseInt(sp.page ?? "1", 10) || 1),
    startedFrom: sp.startedFrom,
    startedTo: sp.startedTo,
    q: sp.q,
    ended: sp.ended === "open" || sp.ended === "closed" ? sp.ended : undefined,
  };
  const [data, consumption, documents, trips] = await Promise.all([
    loadDriver(id),
    showConsumption ? loadDriverConsumption(id, sp.periodFrom, sp.periodTo) : Promise.resolve(null),
    showDocuments ? loadDriverDocuments(id) : Promise.resolve([] as DriverDocumentRecord[]),
    showTrips ? loadDriverTrips(id, tripsSearch) : Promise.resolve(null),
  ]);
  if (!data) notFound();

  const { driver, assignments } = data;

  const tabs = (
    <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă profilul…</p>}>
      <DriverProfileTabs
        driver={driver}
        assignments={assignments}
        documents={documents}
        trips={trips}
        tripsSearch={tripsSearch}
        consumption={consumption}
        canWrite
        canWriteAssignments={false}
        editHref="/fleet/profile/edit"
      />
    </Suspense>
  );

  const desktop = (
    <FleetPageMain>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Profil șofer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{driver.fullName}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>{driverStatusLabel(driver.status)}</span>
            {driver.licenseExpiryStatus === "expiring" || driver.licenseExpiryStatus === "expired" ? (
              <>
                <span className="text-zinc-600">·</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-xs font-medium ${
                    documentExpiryBadge(driver.licenseExpiryStatus).className
                  }`}
                >
                  Permis {documentExpiryBadge(driver.licenseExpiryStatus).label.toLowerCase()}
                </span>
              </>
            ) : null}
            {driver.activeVehicleRegistrations.length > 0 ? (
              <>
                <span className="text-zinc-600">·</span>
                <span className="font-mono text-zinc-500">{driver.activeVehicleRegistrations.join(", ")}</span>
              </>
            ) : null}
          </p>
        </div>
        <Link
          href="/fleet/profile/edit"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          Editare profil
        </Link>
      </div>
      {tabs}
    </FleetPageMain>
  );

  const mobile = (
    <FleetPageMain narrow="sm">
      <header className="flex items-center gap-3">
        {driver.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={driver.photoUrl}
            alt={driver.fullName}
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-200 ring-1 ring-zinc-700">
            {driver.fullName
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("") || "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">Profil șofer</p>
          <h1 className="truncate text-xl font-semibold tracking-tight">{driver.fullName}</h1>
        </div>
        <Link href="/fleet/profile/edit" className="shrink-0 text-sm font-medium text-emerald-400">
          Editare
        </Link>
      </header>
      {tabs}
    </FleetPageMain>
  );

  return <DriverViewportSplit mobile={mobile} desktop={desktop} />;
}
