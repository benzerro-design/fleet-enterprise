import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverAssignmentsPanel } from "@/components/fleet/DriverAssignmentsPanel";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { driverStatusLabel, type DriverDetailPayload } from "@/lib/drivers-api";
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, auth] = await Promise.all([loadDriver(id), getAuthMeResult()]);
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
            {driver.employeeCode ? (
              <>
                <span className="text-zinc-600">·</span>
                <span className="font-mono">{driver.employeeCode}</span>
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

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Date contact & permis</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Telefon</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{driver.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Email</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{driver.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Nr. permis</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{driver.licenseNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Categorii</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{driver.licenseCategories ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Expirare permis</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{formatDate(driver.licenseExpiresOn)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Client</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{driver.clientLegalName}</dd>
            </div>
          </dl>
          {driver.notes?.trim() ? (
            <div className="mt-4">
              <p className="text-xs text-zinc-500">Note</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{driver.notes}</p>
            </div>
          ) : null}
        </section>

        <DriverAssignmentsPanel
          driverId={driver.id}
          clientCode={driver.clientCode}
          initialAssignments={assignments}
          canWrite={canWrite}
        />
      </div>
    </FleetPageMain>
  );
}
