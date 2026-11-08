import Link from "next/link";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { TireHubAnalyticsSnapshot } from "@/components/fleet/TireHubAnalyticsSnapshot";
import { TireHubInventory } from "@/components/fleet/TireHubInventory";
import { TireSeasonReminderSyncButton } from "@/components/fleet/TireSeasonReminderSyncButton";
import {
  canManageFleet,
  canWriteFleetOps,
  getAuthMeResult,
  isClientDriverPortal,
} from "@/lib/auth-server";
import { fleetBrowserBase } from "@/lib/fleet-api";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { TireHubAlert, TireHubPayload } from "@/lib/tire-hub-api";
import { tireHubAlertKindLabel } from "@/lib/tire-hub-api";
import { vehicleTireSeasonLabel } from "@/lib/vehicle-wheels-types";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

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

function tabHref(tab: "hub" | "inventar") {
  return tab === "hub" ? "/fleet/tires?tab=hub" : "/fleet/tires?tab=inventar";
}

export default async function FleetTiresHubPage({ searchParams }: PageProps) {
  const auth = await getAuthMeResult();
  const driverPortal = isClientDriverPortal(auth);
  const canSync = canManageFleet(auth);
  const canWriteTires = canWriteFleetOps(auth) && !driverPortal;
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;
  const rawTab = typeof sp?.tab === "string" ? sp.tab : Array.isArray(sp?.tab) ? sp.tab[0] : undefined;
  const rawVehicleId =
    typeof sp?.vehicleId === "string"
      ? sp.vehicleId
      : Array.isArray(sp?.vehicleId)
        ? sp.vehicleId[0]
        : undefined;
  const rawSetId =
    typeof sp?.setId === "string" ? sp.setId : Array.isArray(sp?.setId) ? sp.setId[0] : undefined;
  const tab: "hub" | "inventar" = driverPortal
    ? "inventar"
    : rawTab === "hub" || rawTab === "inventar"
      ? rawTab
      : rawVehicleId || rawSetId
        ? "inventar"
        : "hub";

  const hub = await loadHub();

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">FLEET-007</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hub anvelope</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400">
              Control tower (alerte, sezon) și inventar detaliat pe set / anvelopă. Drill-down pe tab
              Roți. Scope AccessContext
              {driverPortal ? " — vehiculul tău asignat" : ""}.
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
            {canSync && !driverPortal ? (
              <div className="mt-4">
                <TireSeasonReminderSyncButton />
              </div>
            ) : null}
            <nav className="mt-6 flex gap-4 border-b border-zinc-800 text-sm" aria-label="Secțiuni anvelope">
              {!driverPortal ? (
                <Link
                  href={tabHref("hub")}
                  className={
                    tab === "hub"
                      ? "border-b-2 border-emerald-500 pb-2 font-medium text-zinc-100"
                      : "pb-2 text-zinc-500 hover:text-zinc-300"
                  }
                >
                  Hub
                </Link>
              ) : null}
              <Link
                href={tabHref("inventar")}
                className={
                  tab === "inventar"
                    ? "border-b-2 border-emerald-500 pb-2 font-medium text-zinc-100"
                    : "pb-2 text-zinc-500 hover:text-zinc-300"
                }
              >
                Inventar
              </Link>
            </nav>
          </div>
        }
      >
        {!hub ? (
          <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
            Nu s-au putut încărca datele hub. Verifică API-ul{" "}
            <code className="rounded bg-zinc-950 px-1 text-xs">GET /fleet/tires/hub</code>.
          </p>
        ) : tab === "inventar" ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-zinc-100">Inventar seturi</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Catalog operațional: locație, hotel/raft, uzură/DOT, km/cost, anvelope pe poziție.
                </p>
              </div>
              {!driverPortal ? (
                <a
                  href={`${fleetBrowserBase}/tires/hub/export`}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                >
                  Export CSV
                </a>
              ) : null}
            </div>
            <TireHubInventory
              hub={hub}
              canWrite={canWriteTires}
              initialVehicleId={rawVehicleId ?? null}
              initialSetId={rawSetId ?? null}
            />
          </section>
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

            <TireHubAnalyticsSnapshot hub={hub} />

            {(hub.changeoverQueue?.length ?? 0) > 0 ? (
              <section>
                <h2 className="text-lg font-medium text-zinc-100">Coadă schimb sezon</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Vehicule cu set greșit pentru sezonul curent — leagă de WO tip R dacă există.
                </p>
                <ul className="mt-3 space-y-2">
                  {hub.changeoverQueue!.map((c) => (
                    <li
                      key={c.vehicleId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">
                          {c.plate}{" "}
                          <span className="text-xs font-normal text-zinc-500">· {c.clientCode}</span>
                        </p>
                        <p className="text-xs text-amber-100/80">
                          Montat {vehicleTireSeasonLabel(c.mountedSeason)} — recomandat{" "}
                          {c.recommendedSeason === "winter" ? "iarnă" : "vară"}
                          {c.hasOppositeSeasonStored ? " · set opus disponibil" : " · lipsă set opus"}
                          {c.openWorkOrderStatus
                            ? ` · WO R: ${c.openWorkOrderStatus}`
                            : " · fără WO R deschis"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={c.hrefWheels}
                          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
                        >
                          Roți
                        </Link>
                        {c.hrefWorkOrder ? (
                          <Link
                            href={c.hrefWorkOrder}
                            className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-950/50"
                          >
                            Deschide WO
                          </Link>
                        ) : (
                          <Link
                            href={c.hrefCreateTicket}
                            className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-950/50"
                          >
                            Tichet sezon
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

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
                              Roți
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
                        href={`/fleet/vehicles/${s.vehicleId}?tab=wheels&setId=${encodeURIComponent(s.setId)}`}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                      >
                        Deschide Roți
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="text-xs text-zinc-600">
              Inventarul detaliat e pe tab-ul{" "}
              <Link href={tabHref("inventar")} className="text-sky-400 hover:underline">
                Inventar
              </Link>
              .
            </p>
          </div>
        )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
