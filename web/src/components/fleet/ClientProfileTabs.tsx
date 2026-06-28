"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { formatRonFromCents } from "@/lib/money";
import type { ClientProfileTab, ClientSummaryPayload } from "@/lib/clients-api";
import { clientOpsQuery } from "@/lib/clients-api";
import { ClientSubscriptionTab } from "@/components/fleet/ClientSubscriptionTab";
import { ClientDriversTab } from "@/components/fleet/ClientDriversTab";

const TABS: { id: ClientProfileTab; label: string }[] = [
  { id: "overview", label: "Prezentare" },
  { id: "vehicles", label: "Vehicule" },
  { id: "drivers", label: "Șoferi" },
  { id: "subscription", label: "Abonament" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

function activityKindLabel(kind: ClientSummaryPayload["recentActivity"][0]["kind"]): string {
  switch (kind) {
    case "trip":
      return "Cursă";
    case "cost":
      return "Cost";
    case "maintenance":
      return "Mentenanță";
    default:
      return kind;
  }
}

function ContactRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-200">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

type Props = {
  data: ClientSummaryPayload;
  canWrite?: boolean;
};

export function ClientProfileTabs({ data, canWrite = false }: Props) {
  const { client, kpis, vehicles, recentActivity, subscriptions, drivers } = data;
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientQs = clientOpsQuery(client.code);

  const active = useMemo((): ClientProfileTab => {
    const t = searchParams.get("tab");
    if (t === "vehicles" || t === "subscription" || t === "drivers") return t;
    return "overview";
  }, [searchParams]);

  const setTab = useCallback(
    (tab: ClientProfileTab) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", tab);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="grid gap-3 border-b border-zinc-800 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Vehicule active" value={String(kpis.vehiclesActive)} sub={`din ${kpis.vehiclesTotal}`} />
        <KpiCard
          label="Remindere acțiune"
          value={String(kpis.remindersActionCount)}
          accent={kpis.remindersActionCount > 0 ? "warn" : undefined}
        />
        <KpiCard label="Costuri luna curentă" value={`${formatRonFromCents(kpis.costsMonthCents)} RON`} />
        <KpiCard label="Curse luna curentă" value={String(kpis.tripsMonthCount)} />
        <KpiCard
          label="ITP în 30 zile"
          value={String(kpis.itpWithin30Days)}
          accent={kpis.itpWithin30Days > 0 ? "warn" : undefined}
        />
        <KpiCard label="Sănătate" value={client.healthLabel ?? "OK"} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-4 py-3">
        <QuickLink href={`/fleet/tickets?${clientQs}`} label="Tichete CRM" />
        <QuickLink href={`/fleet/reminders?${clientQs}`} label="Remindere" />
        <QuickLink href={`/fleet/trips?${clientQs}`} label="Curse" />
        <QuickLink href={`/fleet/costs?${clientQs}`} label="Costuri" />
        <QuickLink href={`/fleet/maintenance?${clientQs}`} label="Mentenanță" />
        <QuickLink href={`/fleet/clients/${client.id}?tab=vehicles`} label="Vehicule client" />
        <QuickLink href={`/fleet/clients/${client.id}?tab=drivers`} label="Șoferi client" />
        <QuickLink href={`/fleet/clients/${client.id}?tab=subscription`} label="Abonament" />
      </div>

      <div className="border-b border-zinc-800 px-4 pt-4">
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

      <div className="p-4">
        {active === "overview" ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">Date contact & facturare</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <ContactRow label="Email" value={client.contactEmail} />
                <ContactRow label="Telefon" value={client.contactPhone} />
                <ContactRow label="Adresă" value={client.addressLine} />
                <ContactRow label="Reg. Comerțului" value={client.tradeRegister} />
                <ContactRow label="CUI" value={client.taxId} />
              </dl>
              {client.billingNotes?.trim() ? (
                <div className="mt-4">
                  <p className="text-xs text-zinc-500">Note facturare</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{client.billingNotes}</p>
                </div>
              ) : null}
              {client.notes?.trim() ? (
                <div className="mt-4">
                  <p className="text-xs text-zinc-500">Note interne</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{client.notes}</p>
                </div>
              ) : null}
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-300">Activitate recentă</h3>
              {recentActivity.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">Nicio activitate înregistrată.</p>
              ) : (
                <ul className="mt-4 divide-y divide-zinc-800/80">
                  {recentActivity.map((row, i) => (
                    <li key={`${row.kind}-${row.at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 py-2 text-sm">
                      <span className="text-zinc-500">{formatDate(row.at)}</span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                        {activityKindLabel(row.kind)}
                      </span>
                      <span className="text-zinc-200">{row.label}</span>
                      <Link
                        href={`/fleet/vehicles/${row.vehicleId}`}
                        className="font-mono text-emerald-400 hover:underline"
                      >
                        {row.registrationNumber}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : active === "subscription" ? (
          <ClientSubscriptionTab subscriptions={subscriptions ?? []} />
        ) : active === "drivers" ? (
          <ClientDriversTab clientCode={client.code} drivers={drivers ?? []} canWrite={canWrite} />
        ) : (
          <>
            {vehicles.length === 0 ? (
              <p className="text-sm text-zinc-500">Niciun vehicul alocat acestui client.</p>
            ) : (
              <FleetDataTable>
                <table className={fleetTableClass}>
                  <thead className={fleetTheadClass}>
                    <tr>
                      <th className={fleetThClass}>Nr. înmatriculare</th>
                      <th className={fleetThClass}>Marcă / model</th>
                      <th className={fleetThClass}>Status</th>
                      <th className={fleetThClass}>Odometru</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {vehicles.map((v) => (
                      <tr key={v.id} className="text-zinc-200">
                        <td className={fleetTdClass}>
                          <Link href={`/fleet/vehicles/${v.id}`} className="font-mono text-emerald-400 hover:underline">
                            {v.registrationNumber}
                          </Link>
                        </td>
                        <td className={fleetTdClass}>
                          {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className={`${fleetTdClass} capitalize`}>{v.status}</td>
                        <td className={`${fleetTdClass} font-mono text-zinc-400`}>
                          {v.odometerKm != null ? `${v.odometerKm.toLocaleString("ro-RO")} km` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </FleetDataTable>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "warn";
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${accent === "warn" ? "text-amber-300" : "text-zinc-100"}`}>
        {value}
      </p>
      {sub ? <p className="text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
    >
      {label}
    </Link>
  );
}
