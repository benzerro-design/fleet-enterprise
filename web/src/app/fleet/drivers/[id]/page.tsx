import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DriverProfileTabs } from "@/components/fleet/DriverProfileTabs";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { documentExpiryBadge } from "@/lib/document-expiry";
import { driverStatusLabel, type DriverDetailPayload, type DriverDocumentRecord } from "@/lib/drivers-api";
import type { ConsumptionPayload } from "@/lib/consumption-types";
import { fleetServerFetch } from "@/lib/fleet-server";

function defaultConsumptionPeriod(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

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

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; periodFrom?: string; periodTo?: string }>;
};

export default async function DriverDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const showConsumption = sp.tab === "consumption";
  const showDocuments = sp.tab === "documents";
  const [data, auth, consumption, documents] = await Promise.all([
    loadDriver(id),
    getAuthMeResult(),
    showConsumption ? loadDriverConsumption(id, sp.periodFrom, sp.periodTo) : Promise.resolve(null),
    showDocuments ? loadDriverDocuments(id) : Promise.resolve([] as DriverDocumentRecord[]),
  ]);
  if (!data) notFound();

  const { driver, assignments } = data;
  const canWrite = canManageFleet(auth);

  return (
    <FleetPageMain>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/fleet/drivers" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Șoferi
          </Link>
          <p className="mt-4 text-sm font-medium uppercase tracking-widest text-emerald-400">Profil șofer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{driver.fullName}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <Link href={`/fleet/clients/${driver.clientId}`} className="font-mono text-zinc-300 hover:text-emerald-300">
              {driver.clientCode}
            </Link>
            <span className="text-zinc-600">·</span>
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
            {driver.employeeCode ? (
              <>
                <span className="text-zinc-600">·</span>
                <span className="font-mono">{driver.employeeCode}</span>
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
        {canWrite ? (
          <Link
            href={`/fleet/drivers/${driver.id}/edit`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Editare
          </Link>
        ) : null}
      </div>

      {showConsumption ? (
        <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <input type="hidden" name="tab" value="consumption" />
          <div>
            <label className="text-xs text-zinc-500">De la</label>
            <input
              name="periodFrom"
              type="date"
              defaultValue={sp.periodFrom ?? defaultConsumptionPeriod().from}
              className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Până la</label>
            <input
              name="periodTo"
              type="date"
              defaultValue={sp.periodTo ?? defaultConsumptionPeriod().to}
              className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
            Aplică
          </button>
        </form>
      ) : null}

      <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă profilul…</p>}>
        <DriverProfileTabs
          driver={driver}
          assignments={assignments}
          documents={documents}
          consumption={consumption}
          canWrite={canWrite}
        />
      </Suspense>
    </FleetPageMain>
  );
}
