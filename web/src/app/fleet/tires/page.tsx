import Link from "next/link";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { TireHubAlert, TireHubPayload } from "@/lib/tire-hub-api";
import { tireHubAlertKindLabel } from "@/lib/tire-hub-api";
import { TireSeasonReminderSyncButton } from "@/components/fleet/TireSeasonReminderSyncButton";
import { vehicleTireSeasonLabel } from "@/lib/vehicle-wheels-types";

async function loadHub(): Promise<TireHubPayload | null> {
  try {
    const res = await fleetServerFetch("/fleet/tires/hub");
    if (!res?.ok) return null;
    return (await res.json()) as TireHubPayload;
  } catch {
    return null;
  }
}

function severityClass(severity: TireHubAlert["severity"]): string {
  if (severity === "critical") return "text-red-300 bg-red-950/40 border-red-900/50";
  if (severity === "warning") return "text-amber-200 bg-amber-950/30 border-amber-900/50";
  return "text-sky-200 bg-sky-950/30 border-sky-900/50";
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}

export default async function FleetTiresHubPage() {
  await getAuthMeResult();
  const hub = await loadHub();

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">FLEET-007</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hub anvelope</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400">
              Seturi montate, depozit hotel / client și alerte uzură, DOT și sezon — pe flota ta
              (scope AccessContext).
            </p>
            {hub ? (
              <p className="mt-2 text-xs text-zinc-600">
                Actualizat {new Date(hub.generatedAt).toLocaleString("ro-RO")}
                {hub.seasonRemindersSynced ? (
                  <>
                    {" "}
                    · remindere sezon: {hub.seasonRemindersSynced.created} noi,{" "}
                    {hub.seasonRemindersSynced.updated} actualizate
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="mt-4">
              <TireSeasonReminderSyncButton />
            </div>
          </div>
        }
      >
        {!hub ? (
          <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
            Nu s-au putut încărca datele hub. Verifică API-ul{" "}
            <code className="rounded bg-zinc-950 px-1 text-xs">GET /fleet/tires/hub</code>.
          </p>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Seturi montate" value={hub.summary.setsMounted} />
              <StatCard label="Seturi la hotel" value={hub.summary.setsAtHotel} />
              <StatCard label="Seturi la client" value={hub.summary.setsAtClient} />
              <StatCard label="Uzură sub prag" value={hub.summary.assetsTreadLow} />
              <StatCard label="DOT vechi (≥6 ani)" value={hub.summary.assetsDotAged} />
              <StatCard label="Recomandat înlocuire" value={hub.summary.assetsRecommendedReplace} />
            </div>

            <section>
              <h2 className="text-lg font-medium text-zinc-100">Alerte</h2>
              {hub.alerts.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Nicio alertă activă în scope-ul curent.</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Severitate</th>
                        <th className="px-3 py-2 font-medium">Tip</th>
                        <th className="px-3 py-2 font-medium">Nr. înmatriculare</th>
                        <th className="px-3 py-2 font-medium">Mesaj</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {hub.alerts.map((row, i) => (
                        <tr key={`${row.kind}-${row.vehicleId}-${i}`} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-xs capitalize ${severityClass(row.severity)}`}
                            >
                              {row.severity}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-300">{tireHubAlertKindLabel(row.kind)}</td>
                          <td className="px-3 py-2 font-medium text-zinc-100">{row.plate}</td>
                          <td className="px-3 py-2 text-zinc-400">{row.message}</td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={row.href}
                              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                            >
                              Roti
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {hub.attentionSets.length > 0 ? (
              <section>
                <h2 className="text-lg font-medium text-zinc-100">Seturi care necesită atenție</h2>
                <ul className="mt-3 space-y-2">
                  {hub.attentionSets.map((s) => (
                    <li
                      key={s.setId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">
                          {s.plate}
                          {s.setName ? ` · ${s.setName}` : ""}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {vehicleTireSeasonLabel(s.season)}
                          {s.isMounted ? " · montat" : s.atHotel ? " · hotel" : " · la client"}
                          {" · "}
                          {s.alertKinds.map((k) => tireHubAlertKindLabel(k)).join(", ")}
                        </p>
                      </div>
                      <Link
                        href={`/fleet/vehicles/${s.vehicleId}?tab=wheels`}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                      >
                        Deschide Roti
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
