"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { DriverAssignmentsPanel } from "@/components/fleet/DriverAssignmentsPanel";
import { TripsConsumptionView } from "@/components/fleet/TripsConsumptionView";
import { driverStatusLabel, type DriverAssignmentRecord, type DriverRecord } from "@/lib/drivers-api";
import type { ConsumptionPayload } from "@/lib/consumption-types";

export type DriverProfileTab = "overview" | "vehicles" | "consumption";

const TABS: { id: DriverProfileTab; label: string }[] = [
  { id: "overview", label: "Profil" },
  { id: "vehicles", label: "Istoric vehicule" },
  { id: "consumption", label: "Consum" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

type Props = {
  driver: DriverRecord;
  assignments: DriverAssignmentRecord[];
  consumption: ConsumptionPayload | null;
  canWrite: boolean;
};

export function DriverProfileTabs({ driver, assignments, consumption, canWrite }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active = useMemo((): DriverProfileTab => {
    const t = searchParams.get("tab");
    if (t === "consumption" || t === "vehicles") return t;
    return "overview";
  }, [searchParams]);

  const setTab = useCallback(
    (tab: DriverProfileTab) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", tab);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const activeVehicles = driver.activeVehicleRegistrations;

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`rounded-t-lg border px-4 py-2 text-sm transition-colors ${
                active === tab.id
                  ? "border-zinc-700 border-b-zinc-900 bg-zinc-900 text-emerald-300"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {active === "consumption" ? (
        consumption ? (
          <TripsConsumptionView data={consumption} />
        ) : (
          <p className="text-sm text-amber-400">Nu am putut încărca consumul pentru acest șofer.</p>
        )
      ) : active === "vehicles" ? (
        <DriverAssignmentsPanel
          driverId={driver.id}
          clientCode={driver.clientCode}
          initialAssignments={assignments}
          canWrite={canWrite}
        />
      ) : (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Date contact & permis</h2>
          {activeVehicles.length > 0 ? (
            <p className="mt-2 text-sm text-zinc-400">
              Vehicule active:{" "}
              <span className="font-mono text-emerald-300">{activeVehicles.join(", ")}</span>
              {" · "}
              <button
                type="button"
                onClick={() => setTab("vehicles")}
                className="text-emerald-400 hover:underline"
              >
                Vezi istoric alocări
              </button>
            </p>
          ) : null}
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
              <dt className="text-xs text-zinc-500">Status</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{driverStatusLabel(driver.status)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">Client</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">
                <Link href={`/fleet/clients/${driver.clientId}`} className="text-emerald-400 hover:underline">
                  {driver.clientCode} — {driver.clientLegalName}
                </Link>
              </dd>
            </div>
          </dl>
          {driver.notes?.trim() ? (
            <div className="mt-4">
              <p className="text-xs text-zinc-500">Note</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{driver.notes}</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
