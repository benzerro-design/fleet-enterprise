"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { ClientVehiclesPanel } from "@/components/fleet/ClientVehiclesPanel";
import { IconEye, listGridIconBtnClass } from "@/components/fleet/list-grid-icons";
import { SheetListGrid, type SheetCol } from "@/components/fleet/SheetListGrid";
import { formatRonFromCents } from "@/lib/money";
import type { ClientProfileTab, ClientSummaryActivityRow, ClientSummaryPayload } from "@/lib/clients-api";
import { clientHealthHref, clientOpsQuery } from "@/lib/clients-api";
import { ClientSubscriptionTab } from "@/components/fleet/ClientSubscriptionTab";
import { ClientDriversTab } from "@/components/fleet/ClientDriversTab";
import { ClientMailSettingsEditor } from "@/components/fleet/ClientMailSettingsEditor";
import { ClientPricingSettingsEditor } from "@/components/fleet/ClientPricingSettingsEditor";
import { ClientSlaSettingsEditor } from "@/components/fleet/ClientSlaSettingsEditor";
import { ClientIamSettingsEditor } from "@/components/fleet/ClientIamSettingsEditor";
import { ClientSupplierAllocationsEditor } from "@/components/fleet/ClientSupplierAllocationsEditor";
import { ClientTeamTab } from "@/components/fleet/ClientTeamTab";
import { fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";

const TABS: { id: ClientProfileTab; label: string }[] = [
  { id: "overview", label: "Prezentare" },
  { id: "vehicles", label: "Vehicule" },
  { id: "drivers", label: "Șoferi" },
  { id: "team", label: "Echipă" },
  { id: "subscription", label: "Abonament" },
  { id: "mail", label: "Corespondență" },
  { id: "pricing", label: "Prețuri" },
  { id: "sla", label: "SLA" },
  { id: "iam", label: "Drepturi & politici L1" },
  { id: "suppliers", label: "Furnizori" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

function activityKindLabel(kind: ClientSummaryActivityRow["kind"]): string {
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

function activityHref(row: ClientSummaryActivityRow): string {
  if (row.kind === "trip") return `/fleet/trips/${row.id}`;
  if (row.kind === "cost") return `/fleet/costs/${row.id}`;
  return `/fleet/maintenance/${row.id}`;
}

const ACTIVITY_COLUMNS: SheetCol<"when" | "kind" | "vehicle" | "actions">[] = [
  { key: "when", label: "Activitate", defaultVisible: true, canHide: false, width: "46%" },
  { key: "kind", label: "Tip", defaultVisible: true, canHide: true, width: "16%" },
  { key: "vehicle", label: "Vehicul", defaultVisible: true, canHide: true, width: "22%" },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, width: "7.5rem", align: "right" },
];

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
  canAllocateSuppliers?: boolean;
  canInviteTeam?: boolean;
  canEditIam?: boolean;
};

export function ClientProfileTabs({
  data,
  canWrite = false,
  canAllocateSuppliers = false,
  canInviteTeam = false,
  canEditIam = false,
}: Props) {
  const { client, kpis, recentActivity, subscriptions, drivers } = data;
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientQs = clientOpsQuery(client.code);

  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) => {
        if (tab.id === "iam") return canEditIam;
        if (tab.id === "team") return canInviteTeam;
        return true;
      }),
    [canEditIam, canInviteTeam],
  );

  const active = useMemo((): ClientProfileTab => {
    const t = searchParams.get("tab");
    if (t === "iam" && !canEditIam) return "overview";
    if (t === "team" && !canInviteTeam) return "overview";
    if (
      t === "vehicles" ||
      t === "subscription" ||
      t === "drivers" ||
      t === "team" ||
      t === "mail" ||
      t === "pricing" ||
      t === "iam" ||
      t === "suppliers"
    ) {
      return t;
    }
    return "overview";
  }, [searchParams, canEditIam, canInviteTeam]);

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
        <KpiCard
          label="Vehicule active"
          value={String(kpis.vehiclesActive)}
          sub={`din ${kpis.vehiclesTotal}`}
          href={`/fleet/clients/${client.id}?tab=vehicles`}
        />
        <KpiCard
          label="Remindere acțiune"
          value={String(kpis.remindersActionCount)}
          accent={kpis.remindersActionCount > 0 ? "warn" : undefined}
          href={`/fleet/reminders?${clientQs}&status=action`}
        />
        <KpiCard
          label="Costuri luna curentă"
          value={`${formatRonFromCents(kpis.costsMonthCents)} RON`}
          href={`/fleet/costs?${clientQs}`}
        />
        <KpiCard
          label="Curse luna curentă"
          value={String(kpis.tripsMonthCount)}
          href={`/fleet/trips?${clientQs}`}
        />
        <KpiCard
          label="ITP în 30 zile"
          value={String(kpis.itpWithin30Days)}
          accent={kpis.itpWithin30Days > 0 ? "warn" : undefined}
          href={`/fleet/clients/${client.id}?tab=vehicles`}
        />
        <KpiCard
          label="Sănătate"
          value={client.healthLabel ?? "OK"}
          accent={kpis.remindersActionCount > 0 || kpis.itpWithin30Days > 0 ? "warn" : undefined}
          href={clientHealthHref(client, kpis)}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-4 py-3">
        <QuickLink href={`/fleet/tickets?${clientQs}`} label="Tichete CRM" />
        <QuickLink href={`/fleet/reminders?${clientQs}`} label="Remindere" />
        <QuickLink href={`/fleet/trips?${clientQs}`} label="Curse" />
        <QuickLink href={`/fleet/costs?${clientQs}`} label="Costuri" />
        <QuickLink href={`/fleet/maintenance?${clientQs}`} label="Mentenanță" />
        <QuickLink href={`/fleet/clients/${client.id}?tab=vehicles`} label="Vehicule client" />
        <QuickLink href={`/fleet/clients/${client.id}?tab=drivers`} label="Șoferi client" />
        {canInviteTeam ? (
          <QuickLink href={`/fleet/clients/${client.id}?tab=team`} label="Echipă" />
        ) : null}
        <QuickLink href={`/fleet/clients/${client.id}?tab=subscription`} label="Abonament" />
        <QuickLink href={`/fleet/clients/${client.id}?tab=mail`} label="Corespondență daună" />
        <QuickLink href={`/fleet/clients/${client.id}?tab=suppliers`} label="Furnizori" />
      </div>

      <div className="border-b border-zinc-800 px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={fleetSheetTabClass(active === tab.id)}
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
                <div className="mt-4">
                  <SheetListGrid
                    storageKey="fleet-client-activity-grid-v1"
                    pickerTitle="Coloane activitate"
                    columns={ACTIVITY_COLUMNS}
                    rows={recentActivity}
                    rowKey={(row) => `${row.kind}-${row.id}`}
                    searchPlaceholder="Titlu, nr. înmatriculare…"
                    searchText={(row) => `${row.label} ${row.registrationNumber} ${activityKindLabel(row.kind)}`}
                    empty={<p>Nicio activitate pentru căutarea curentă.</p>}
                    renderCell={(key, row) => {
                      if (key === "when") {
                        return (
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-zinc-100">{row.label}</p>
                            <p className="mt-0.5 truncate text-xs text-zinc-500">{formatDate(row.at)}</p>
                          </div>
                        );
                      }
                      if (key === "kind") {
                        return (
                          <span className="inline-flex rounded-md border border-zinc-600 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                            {activityKindLabel(row.kind)}
                          </span>
                        );
                      }
                      if (key === "vehicle") {
                        return (
                          <Link
                            href={`/fleet/vehicles/${row.vehicleId}`}
                            className="font-mono text-[13px] text-emerald-400 hover:underline"
                          >
                            {row.registrationNumber}
                          </Link>
                        );
                      }
                      return (
                        <Link
                          href={activityHref(row)}
                          className={`${listGridIconBtnClass} text-emerald-400/90 hover:text-emerald-300`}
                          title="Vezi detaliu"
                          aria-label={`Vezi ${activityKindLabel(row.kind)}`}
                        >
                          <IconEye className="h-3.5 w-3.5" />
                        </Link>
                      );
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : active === "subscription" ? (
          <ClientSubscriptionTab subscriptions={subscriptions ?? []} />
        ) : active === "drivers" ? (
          <ClientDriversTab clientCode={client.code} drivers={drivers ?? []} canWrite={canWrite} />
        ) : active === "team" ? (
          <ClientTeamTab clientId={client.id} clientCode={client.code} canInvite={canInviteTeam} />
        ) : active === "mail" ? (
          <ClientMailSettingsEditor clientId={client.id} canWrite={canWrite} />
        ) : active === "pricing" ? (
          <ClientPricingSettingsEditor clientId={client.id} canWrite={canWrite} />
        ) : active === "sla" ? (
          <ClientSlaSettingsEditor clientId={client.id} canWrite={canWrite} />
        ) : active === "iam" ? (
          <ClientIamSettingsEditor clientId={client.id} canWrite={canEditIam} />
        ) : active === "suppliers" ? (
          <ClientSupplierAllocationsEditor clientId={client.id} canWrite={canAllocateSuppliers} />
        ) : (
          <ClientVehiclesPanel clientCode={client.code} canWrite={canWrite} />
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
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "warn";
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${accent === "warn" ? "text-amber-300" : "text-zinc-100"}`}>
        {value}
      </p>
      {sub ? <p className="text-xs text-zinc-500">{sub}</p> : null}
    </>
  );
  const className = `rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 ${
    href ? "transition-colors hover:border-zinc-600 hover:bg-zinc-900/80" : ""
  }`;
  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
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
