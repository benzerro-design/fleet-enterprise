"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { WorkOrderCompleteButton } from "@/components/fleet/work-orders/WorkOrderCompleteButton";
import { WorkOrderQuotePanel } from "@/components/fleet/work-orders/WorkOrderQuotePanel";
import { schedulerHref } from "@/lib/scheduler-deep-link";
import {
  SERVICE_ORDER_TYPES,
  buildWorkOrderMilestones,
  serviceOrderTypeLabel,
  type ServiceOrderTypeCode,
} from "@/lib/work-order-sheet";
import {
  fleetJsonHeaders,
  formatMoneyCents,
  workOrdersBrowserBase,
  type ServiceOrderType,
  type WorkOrderDetail,
} from "@/lib/work-orders-api";

type Props = {
  wo: WorkOrderDetail;
  canWrite: boolean;
  canApprove: boolean;
  hasInvoicedQuote: boolean;
  hasCostFromQuote: boolean;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO");
}

function fmtItp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO");
}

function panelClass() {
  return "min-h-[220px] border-r border-zinc-800 p-3 last:border-r-0";
}

function panelTitle(label: string) {
  return <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>;
}

function sheetBtn(primary?: boolean) {
  return [
    "inline-flex h-7 items-center justify-center rounded px-2.5 text-xs whitespace-nowrap",
    primary
      ? "border border-violet-500/50 bg-violet-950/50 font-semibold text-violet-100 hover:bg-violet-900/40"
      : "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
  ].join(" ");
}

export function WorkOrderSheetShell({ wo, canWrite, canApprove, hasInvoicedQuote, hasCostFromQuote }: Props) {
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceOrderType>(wo.serviceOrderType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kmIn, setKmIn] = useState(wo.odometerKmIn != null ? String(wo.odometerKmIn) : "");
  const [kmOut, setKmOut] = useState(wo.odometerKmOut != null ? String(wo.odometerKmOut) : "");

  const milestones = useMemo(
    () => buildWorkOrderMilestones({ ...wo, serviceOrderType: serviceType }, { canMarkReady: canWrite }),
    [wo, serviceType, canWrite],
  );

  const totalDisplay =
    wo.quoteSummary.totalGrossCents != null
      ? formatMoneyCents(wo.quoteSummary.totalGrossCents, wo.quoteSummary.currency ?? "RON")
      : "—";

  const schedulerLink =
    wo.linkedAppointmentScheduledAt || wo.plannedAt
      ? schedulerHref({
          week: new Date(wo.linkedAppointmentScheduledAt ?? wo.plannedAt!),
          select: wo.linkedAppointmentId ?? undefined,
        })
      : null;

  const patchServiceTimes = useCallback(
    async (body: Record<string, string | number>) => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`${workOrdersBrowserBase}/${wo.id}/service-times`, {
          method: "PATCH",
          headers: fleetJsonHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? `HTTP ${res.status}`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Eroare");
      } finally {
        setPending(false);
      }
    },
    [wo.id, router],
  );

  async function markIn() {
    const body: Record<string, string | number> = { inServiceAt: new Date().toISOString() };
    if (kmIn.trim()) {
      const n = parseInt(kmIn, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km intrare invalid.");
        return;
      }
      body.odometerKmIn = n;
    }
    await patchServiceTimes(body);
  }

  async function markOut() {
    const body: Record<string, string | number> = { outServiceAt: new Date().toISOString() };
    if (kmOut.trim()) {
      const n = parseInt(kmOut, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km ieșire invalid.");
        return;
      }
      body.odometerKmOut = n;
    }
    await patchServiceTimes(body);
  }

  async function changeServiceType(code: ServiceOrderTypeCode) {
    if (code === serviceType) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${wo.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ serviceOrderType: code }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setServiceType(code);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  async function markWorkReady() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${wo.id}/mark-ready`, {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  const receptionActions: { label: string; onClick: () => void }[] = [];
  if (canWrite) {
    if (!wo.inServiceAt) receptionActions.push({ label: "Intrare km", onClick: () => void markIn() });
    if (wo.inServiceAt && !wo.outServiceAt) receptionActions.push({ label: "Ieșire km", onClick: () => void markOut() });
  }

  const navActions: { label: string; href: string }[] = [
    { label: "← Inbox", href: "/fleet/work-orders" },
    { label: "Vehicul", href: `/fleet/vehicles/${wo.vehicleId}` },
  ];
  if (schedulerLink) navActions.push({ label: "Programator", href: schedulerLink });
  if (wo.sourceTicketId) navActions.push({ label: "Tichet", href: `/fleet/tickets/${wo.sourceTicketId}` });

  const toolbarGroups = [
    { label: "Comandă", items: [] as { label: string; href?: string; onClick?: () => void }[] },
    { label: "Recepție", items: receptionActions },
    { label: "Navigare", items: navActions },
  ];

  return (
    <div className="space-y-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/80">
      <div className="overflow-x-auto border-b border-zinc-800 bg-zinc-900/60 px-2 py-2">
        <div className="grid min-w-[640px] grid-cols-3 gap-1.5">
          {toolbarGroups.map((g) => (
            <div key={g.label} className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5">
              <div className="mb-1 text-[9px] font-semibold uppercase text-zinc-500">{g.label}</div>
              <div className="flex flex-wrap gap-1">
                {g.items.map((act) =>
                  "href" in act && act.href ? (
                    <Link key={act.label} href={act.href} className={sheetBtn()}>
                      {act.label}
                    </Link>
                  ) : (
                    <button
                      key={act.label}
                      type="button"
                      disabled={pending}
                      onClick={"onClick" in act ? act.onClick : undefined}
                      className={sheetBtn(true)}
                    >
                      {act.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b-2 border-zinc-700 bg-zinc-900/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold">
          <span>
            {wo.displayNumber ?? wo.title} · {wo.registrationNumber} · {wo.supplierLegalName ?? "—"} · Total deviz{" "}
            {totalDisplay}
          </span>
          <span className="flex items-center gap-1 text-xs font-normal text-zinc-400">
            Tip:
            {SERVICE_ORDER_TYPES.map((st) => (
              <button
                key={st.code}
                type="button"
                disabled={!canWrite || pending}
                onClick={() => void changeServiceType(st.code)}
                className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                  serviceType === st.code
                    ? "border-violet-500/60 bg-violet-950/50 text-violet-200"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {st.code}
              </button>
            ))}
            <span className="text-zinc-300">{serviceOrderTypeLabel(serviceType)}</span>
          </span>
        </div>
      </div>

      {error ? <p className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-sm text-red-400">{error}</p> : null}

      <div className="grid border-b border-zinc-800 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className={panelClass()}>
          {panelTitle("Tranzacție")}
          <div className="space-y-1 text-xs text-zinc-300">
            {wo.sourceTicketId ? (
              <div>
                Referință{" "}
                <Link href={`/fleet/tickets/${wo.sourceTicketId}`} className="text-emerald-400 hover:underline">
                  #{wo.ticketDisplayId}
                </Link>
              </div>
            ) : null}
            <div>Programare: {fmtDate(wo.plannedAt ?? wo.linkedAppointmentScheduledAt)}</div>
            <div className="pt-1 font-semibold text-zinc-100">Total: {totalDisplay}</div>
          </div>
        </div>

        <div className={panelClass()}>
          {panelTitle("Vehicul + Client")}
          <dl className="space-y-1 text-xs">
            <Row label="Nr. înmatriculare" value={wo.vehicle.registrationNumber} />
            <Row
              label="Marcă / model"
              value={[wo.vehicle.brand, wo.vehicle.model].filter(Boolean).join(" ") || "—"}
            />
            <Row label="VIN / șasiu" value={wo.vehicle.vin ?? "—"} mono />
            <Row label="Km flotă" value={`${wo.vehicle.odometerKm.toLocaleString("ro-RO")} km`} />
            <Row label="ITP expiră" value={fmtItp(wo.vehicle.itpExpiresOn)} />
            <div className="my-2 border-t border-zinc-800" />
            <Row label="Denumire" value={wo.client.legalName} />
            <Row label="CUI" value={wo.client.taxId ?? "—"} />
            <Row label="Adresă" value={wo.client.addressLine ?? "—"} />
            <Row
              label="Contact"
              value={[wo.client.contactPhone, wo.client.contactEmail].filter(Boolean).join(" · ") || "—"}
            />
            <Row label="Grupă / contract" value={wo.client.billingNotes ?? "—"} />
          </dl>
          <p className="mt-2 text-[10px] text-zinc-600">Read-only — date master flotă</p>
        </div>

        <div className={panelClass()}>
          {panelTitle("Partener + Responsabil")}
          {wo.supplier ? (
            <div className="space-y-2 text-xs text-zinc-300">
              <div>
                <div className="font-medium text-zinc-100">{wo.supplier.legalName}</div>
                {wo.supplier.taxId ? <div className="text-zinc-500">{wo.supplier.taxId}</div> : null}
                <div className="text-zinc-500">
                  {[wo.supplier.addressLine, wo.supplier.city].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="text-zinc-500">
                  {[wo.supplier.contactPhone, wo.supplier.contactEmail].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="border-t border-zinc-800 pt-2">
                <div className="text-[10px] uppercase text-zinc-500">Contact service</div>
                <div className="text-zinc-400">Coordonator alocat pe comandă (pilot: contact furnizor)</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Fără furnizor alocat</p>
          )}
        </div>

        <div className={`${panelClass()} bg-zinc-900/40`}>
          {panelTitle("Stare (Tila)")}
          <ul className="space-y-1">
            {milestones.map((m) => (
              <li key={m.id} className={`flex items-center gap-2 text-[11px] ${m.done || m.active ? "" : "opacity-50"}`}>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${
                    m.done ? "border-violet-500 bg-violet-600" : m.active ? "border-violet-400" : "border-zinc-600"
                  }`}
                />
                <span className={m.active ? "font-semibold text-zinc-100" : "text-zinc-300"}>{m.label}</span>
                <span className="ml-auto text-[10px] text-zinc-500">{m.date ?? "—"}</span>
                {m.canToggle ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void markWorkReady()}
                    className="ml-1 rounded border border-emerald-600/50 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-950/30"
                  >
                    Bifează
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className={panelClass()}>
          {panelTitle("Rezumat")}
          <div className="space-y-1 text-xs text-zinc-400">
            {wo.ticketSubject ? (
              <div>
                #{wo.ticketDisplayId}: {wo.ticketSubject}
              </div>
            ) : null}
            {wo.driverName ? (
              <div>
                Șofer: {wo.driverName}
                {wo.driverPhone ? ` · ${wo.driverPhone}` : ""}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <label className="text-zinc-500">
                Km in
                <input
                  type="number"
                  min={0}
                  value={kmIn}
                  disabled={!canWrite}
                  onChange={(e) => setKmIn(e.target.value)}
                  className="ml-1 w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 font-mono text-zinc-200"
                />
              </label>
              <label className="text-zinc-500">
                Km out
                <input
                  type="number"
                  min={0}
                  value={kmOut}
                  disabled={!canWrite}
                  onChange={(e) => setKmOut(e.target.value)}
                  className="ml-1 w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 font-mono text-zinc-200"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <WorkOrderQuotePanel workOrderId={wo.id} canWrite={canWrite} canApprove={canApprove} sheetLayout />

      <div className="border-t border-zinc-800 px-4 py-3">
        <WorkOrderCompleteButton
          workOrderId={wo.id}
          canWrite={canWrite}
          status={wo.status}
          hasInvoicedQuote={hasInvoicedQuote}
          hasCostFromQuote={hasCostFromQuote}
        />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
