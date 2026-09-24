"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkOrderCompleteButton } from "@/components/fleet/work-orders/WorkOrderCompleteButton";
import { WorkOrderMessageThread } from "@/components/fleet/work-orders/WorkOrderMessageThread";
import { WorkOrderPhotoGallery } from "@/components/fleet/work-orders/WorkOrderPhotoGallery";
import { WorkOrderQuotePanel } from "@/components/fleet/work-orders/WorkOrderQuotePanel";
import { schedulerHref } from "@/lib/scheduler-deep-link";
import { formatDateRo } from "@/lib/datetime-local";
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
import { workOrderDisplayLabel } from "@/lib/work-order-display";
import { MobilityWoBanner } from "@/components/fleet/MobilityWoBanner";
import { MobilityAssignmentForm } from "@/components/fleet/MobilityAssignmentForm";
import { WorkOrderMobilitySummary } from "@/components/fleet/work-orders/WorkOrderMobilitySummary";
import {
  DamageClaimPanel,
  serviceCaseFromWorkOrderDamage,
} from "@/components/fleet/tickets/DamageClaimPanel";
import { PartnerSourceTicketPanel } from "@/components/fleet/partner/PartnerSourceTicketPanel";
import { fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";
import {
  isDamageInsurerReady,
  serviceCasesBrowserBase,
  type ServiceCaseRecord,
} from "@/lib/service-cases-api";
import { appointmentStatusLabel } from "@/lib/appointments-api";
import {
  DEFAULT_WORK_ORDER_SETTINGS,
  type WorkOrderSettings,
} from "@/lib/work-order-settings";

type Props = {
  wo: WorkOrderDetail;
  canWrite: boolean;
  canApprove: boolean;
  /** Retrimite spre aprobare — partener sau tenant_admin (nu manager L1). */
  canResubmitQuote?: boolean;
  hasInvoicedQuote: boolean;
  hasCostFromQuote: boolean;
  isPartner?: boolean;
  workOrderSettings?: WorkOrderSettings;
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

export function WorkOrderSheetShell({
  wo,
  canWrite,
  canApprove,
  canResubmitQuote = false,
  hasInvoicedQuote,
  hasCostFromQuote,
  isPartner = false,
  workOrderSettings = DEFAULT_WORK_ORDER_SETTINGS,
}: Props) {
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceOrderType>(wo.serviceOrderType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kmIn, setKmIn] = useState(wo.odometerKmIn != null ? String(wo.odometerKmIn) : "");
  const [kmOut, setKmOut] = useState(wo.odometerKmOut != null ? String(wo.odometerKmOut) : "");
  const [kmIn2, setKmIn2] = useState(wo.visit2OdometerKmIn != null ? String(wo.visit2OdometerKmIn) : "");
  const [kmOut2, setKmOut2] = useState(wo.visit2OdometerKmOut != null ? String(wo.visit2OdometerKmOut) : "");
  const extraVisits = wo.extraVisits ?? [];
  const [extraKm, setExtraKm] = useState<Record<number, { in: string; out: string }>>(() => {
    const init: Record<number, { in: string; out: string }> = {};
    for (const v of extraVisits) {
      init[v.n] = {
        in: v.odometerKmIn != null ? String(v.odometerKmIn) : "",
        out: v.odometerKmOut != null ? String(v.odometerKmOut) : "",
      };
    }
    return init;
  });
  const [fleetOdoNotice, setFleetOdoNotice] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [sheetView, setSheetView] = useState<"comanda" | "dosar" | "mobilitate">("comanda");
  const [rezumatTab, setRezumatTab] = useState<string>("v1");
  const [tilaTrack, setTilaTrack] = useState<1 | 2>(1);
  /** Dosar pe WO: același ServiceCase ca pe tichet (nu mapare parțială din WO). */
  const [dosarServiceCase, setDosarServiceCase] = useState<ServiceCaseRecord | null>(null);
  const requireKm = workOrderSettings.requireServiceKm;
  const isDamageWo = wo.workflowType === "damage";

  useEffect(() => {
    if (!isDamageWo || sheetView !== "dosar") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${serviceCasesBrowserBase}/${wo.serviceCaseId}`, {
          headers: fleetJsonHeaders(),
        });
        if (!res.ok || cancelled) return;
        const next = (await res.json()) as ServiceCaseRecord;
        if (!cancelled) setDosarServiceCase(next);
      } catch {
        /* fallback: mapare din WO */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDamageWo, sheetView, wo.serviceCaseId, wo.updatedAt]);
  const damageGateReady = isDamageInsurerReady({
    damagePayerType: wo.damagePayerType,
    damageInsurerPipelineStatus: wo.damageInsurerPipelineStatus,
    damageInsurerAgreedAt: wo.damageInsurerAgreedAt,
  });
  const damageGateBlocked =
    isDamageWo &&
    wo.quoteSummary.status === "approved" &&
    wo.status !== "in_progress" &&
    wo.status !== "waiting_parts" &&
    wo.status !== "done" &&
    !damageGateReady;

  const useVisit2 = wo.postApprovalPath === "reschedule" && !!wo.outServiceAt;
  const outServiceDone = useVisit2 ? !!wo.visit2OutServiceAt : !!wo.outServiceAt;
  const ticketSettlement = wo.ticketSettlement ?? null;

  const fleetAlignedFromService =
    (wo.odometerKmOut != null && wo.vehicle.odometerKm === wo.odometerKmOut) ||
    (wo.odometerKmIn != null && wo.vehicle.odometerKm === wo.odometerKmIn);

  const milestones = useMemo(
    () =>
      buildWorkOrderMilestones(
        { ...wo, serviceOrderType: serviceType },
        { canMarkReady: canWrite, tilaTrack },
      ),
    [wo, serviceType, canWrite, tilaTrack],
  );

  const totalDisplay =
    wo.quoteSummary.totalGrossCents != null
      ? formatMoneyCents(wo.quoteSummary.totalGrossCents, wo.quoteSummary.currency ?? "RON")
      : "—";

  const schedulerLink =
    wo.linkedAppointmentId || wo.linkedAppointmentScheduledAt || wo.plannedAt
      ? schedulerHref({
          basePath: isPartner ? "/fleet/partner/appointments" : "/fleet/scheduler",
          week: new Date(wo.linkedAppointmentScheduledAt ?? wo.plannedAt ?? Date.now()),
          select: wo.linkedAppointmentId ?? undefined,
        })
      : schedulerHref({
          basePath: isPartner ? "/fleet/partner/appointments" : "/fleet/scheduler",
          ticket: wo.sourceTicketId ?? undefined,
          vehicle: wo.vehicleId,
          reg: wo.registrationNumber,
          case: wo.serviceCaseId,
          supplier: wo.supplierId ?? undefined,
          create: true,
        });

  const patchServiceTimes = useCallback(
    async (body: Record<string, string | number>) => {
      setPending(true);
      setError(null);
      setFleetOdoNotice(null);
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
        const j = (await res.json().catch(() => ({}))) as {
          fleetOdometerUpdate?: { updated: boolean; previousKm: number; newKm: number | null };
        };
        if (j.fleetOdometerUpdate?.updated && j.fleetOdometerUpdate.newKm != null) {
          setFleetOdoNotice(
            `Odometru flotă actualizat: ${j.fleetOdometerUpdate.previousKm.toLocaleString("ro-RO")} → ${j.fleetOdometerUpdate.newKm.toLocaleString("ro-RO")} km`,
          );
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
    const kmVal = useVisit2 ? kmIn2 : kmIn;
    if (kmVal.trim()) {
      const n = parseInt(kmVal, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km intrare invalid.");
        return;
      }
      body.odometerKmIn = n;
    } else if (requireKm) {
      setError("Km intrare este obligatoriu.");
      return;
    }
    await patchServiceTimes(body);
  }

  async function markOut() {
    const body: Record<string, string | number> = { outServiceAt: new Date().toISOString() };
    const kmVal = useVisit2 ? kmOut2 : kmOut;
    if (kmVal.trim()) {
      const n = parseInt(kmVal, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km ieșire invalid.");
        return;
      }
      body.odometerKmOut = n;
    } else if (requireKm) {
      setError("Km ieșire este obligatoriu.");
      return;
    }
    await patchServiceTimes(body);
  }

  async function markExtraIn(n: number) {
    const body: Record<string, string | number> = {
      visitIndex: n,
      inServiceAt: new Date().toISOString(),
    };
    const kmVal = extraKm[n]?.in ?? "";
    if (kmVal.trim()) {
      const km = parseInt(kmVal, 10);
      if (!Number.isFinite(km) || km < 0) {
        setError("Km intrare invalid.");
        return;
      }
      body.odometerKmIn = km;
    } else if (requireKm) {
      setError("Km intrare este obligatoriu.");
      return;
    }
    await patchServiceTimes(body);
  }

  async function markExtraOut(n: number) {
    const body: Record<string, string | number> = {
      visitIndex: n,
      outServiceAt: new Date().toISOString(),
    };
    const kmVal = extraKm[n]?.out ?? "";
    if (kmVal.trim()) {
      const km = parseInt(kmVal, 10);
      if (!Number.isFinite(km) || km < 0) {
        setError("Km ieșire invalid.");
        return;
      }
      body.odometerKmOut = km;
    } else if (requireKm) {
      setError("Km ieșire este obligatoriu.");
      return;
    }
    await patchServiceTimes(body);
  }

  async function addExtraVisit() {
    const last = extraVisits.length ? extraVisits[extraVisits.length - 1]!.n : 2;
    await patchServiceTimes({ visitIndex: last + 1 });
  }

  async function applyPostApproval(path: "immediate" | "reschedule") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${wo.serviceCaseId}/post-approval`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ path }),
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

  async function startSupplementRepair() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${wo.id}/start-supplement-repair`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({}),
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

  const hasLucrare2 = Boolean(
    wo.supplementRepairAt ||
      (wo.supplementQuoteVersion != null && wo.supplementQuoteVersion >= 2) ||
      wo.lucrare1ReadyAt,
  );

  useEffect(() => {
    if (hasLucrare2 && wo.supplementRepairAt && !wo.readyAt) {
      setTilaTrack(2);
    }
  }, [hasLucrare2, wo.supplementRepairAt, wo.readyAt]);

  const canStartNewLucrare =
    canWrite &&
    !!wo.inServiceAt &&
    !(wo.outServiceAt && !wo.visit2InServiceAt) &&
    !!wo.readyAt &&
    !hasLucrare2;

  const navActions: { label: string; href: string }[] = isPartner
    ? [
        { label: "← Inbox", href: "/fleet/partner/work-orders" },
        { label: "Programator", href: schedulerLink },
      ]
    : [
        { label: "← Inbox", href: "/fleet/work-orders" },
        { label: "Vehicul", href: `/fleet/vehicles/${wo.vehicleId}` },
        { label: "Programator", href: schedulerLink },
        ...(wo.sourceTicketId
          ? [{ label: "Tichet", href: `/fleet/tickets/${wo.sourceTicketId}` }]
          : []),
      ];

  const toolbarGroups = [
    {
      label: "Comandă",
      items: [] as { label: string; href?: string; onClick?: () => void }[],
    },
    { label: "Navigare", items: navActions },
  ];

  return (
    <div className="space-y-0 rounded-xl border border-zinc-700 bg-zinc-950/80">
      <div className="overflow-x-auto border-b border-zinc-800 bg-zinc-900/60 px-2 py-2">
        <div className={`grid min-w-[640px] gap-1.5 ${isDamageWo ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
          {toolbarGroups.map((g) => {
            if (g.label === "Comandă") {
              return (
                <div
                  key={g.label}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 pt-1.5"
                >
                  <div className="mb-0 px-1 text-[9px] font-semibold uppercase text-zinc-500">
                    Comandă
                  </div>
                  <nav className="border-b border-zinc-800">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setSheetView("comanda")}
                        className={fleetSheetTabClass(sheetView === "comanda")}
                      >
                        Comandă
                      </button>
                      {isDamageWo ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setSheetView("dosar")}
                          className={fleetSheetTabClass(sheetView === "dosar")}
                        >
                          Dosar daună
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setSheetView("mobilitate")}
                        className={fleetSheetTabClass(sheetView === "mobilitate")}
                      >
                        Mobilitate
                      </button>
                    </div>
                  </nav>
                </div>
              );
            }
            return (
              <div key={g.label} className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5">
                <div className="mb-1 text-[9px] font-semibold uppercase text-zinc-500">{g.label}</div>
                <div className="flex flex-wrap gap-1">
                  {g.items.length === 0 && g.label === "Comandă" ? (
                    <span className="text-[10px] text-zinc-600">—</span>
                  ) : null}
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
            );
          })}
        </div>
      </div>

      <div className="border-b-2 border-zinc-700 bg-zinc-900/80 px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-lg font-semibold tracking-tight text-violet-300">
            {workOrderDisplayLabel(wo)}
          </div>
          {sheetView === "comanda" ? (
            <>
              <div className="text-sm font-medium text-zinc-200">{wo.title}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                {!isPartner && wo.vehicleId ? (
                  <Link
                    href={`/fleet/vehicles/${wo.vehicleId}`}
                    className="text-sky-300 hover:underline"
                  >
                    {wo.registrationNumber}
                  </Link>
                ) : (
                  <span>{wo.registrationNumber}</span>
                )}
                <span>·</span>
                {!isPartner && wo.supplierId ? (
                  <Link
                    href={`/fleet/suppliers/${wo.supplierId}`}
                    className="text-sky-300 hover:underline"
                  >
                    {wo.supplierLegalName ?? "—"}
                  </Link>
                ) : (
                  <span>{wo.supplierLegalName ?? "—"}</span>
                )}
                <span>·</span>
                <span>
                  Total deviz <span className="font-mono text-zinc-200">{totalDisplay}</span>
                </span>
              </div>
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
            </>
          ) : sheetView === "mobilitate" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>Mobilitate — mașină la schimb</span>
              <span>·</span>
              <span>{wo.registrationNumber}</span>
              <button
                type="button"
                onClick={() => setSheetView("comanda")}
                className="text-sky-300 hover:underline"
              >
                ← înapoi la comandă
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>Dosar daună</span>
              <span>·</span>
              <span>{wo.registrationNumber}</span>
              <button
                type="button"
                onClick={() => setSheetView("comanda")}
                className="text-sky-300 hover:underline"
              >
                ← înapoi la comandă
              </button>
            </div>
          )}
        </div>
      </div>

      {isDamageWo && sheetView === "dosar" ? (
        <div className="border-b border-zinc-800 px-4 py-4">
          <DamageClaimPanel
            serviceCase={dosarServiceCase ?? serviceCaseFromWorkOrderDamage(wo)}
            canWrite={canWrite}
            compact
            fromWorkOrder
            registrationNumber={wo.registrationNumber}
            onUpdated={(next) => {
              setDosarServiceCase(next);
              router.refresh();
            }}
          />
        </div>
      ) : null}

      {sheetView === "mobilitate" ? (
        <div className="border-b border-zinc-800 px-4 py-4 space-y-6">
          <WorkOrderMobilitySummary workOrderId={wo.id} />
          {canWrite ? (
            <MobilityAssignmentForm
              workOrderId={wo.id}
              embedded
              prefill={{
                coveredVehicleReg: wo.registrationNumber,
                workOrderDisplayNumber: workOrderDisplayLabel(wo),
              }}
              onSaved={() => {
                setSheetView("comanda");
                router.refresh();
              }}
            />
          ) : (
            <p className="text-sm text-zinc-500">Nu ai drept de alocare pe această comandă.</p>
          )}
        </div>
      ) : null}

      {sheetView === "comanda" ? (
        <>
      <MobilityWoBanner
        workOrderId={wo.id}
        canWrite={canWrite}
        damageRequired={isDamageWo}
        onAllocate={() => setSheetView("mobilitate")}
      />
      <WorkOrderMobilitySummary workOrderId={wo.id} />

      {isDamageWo ? (
        <div className="border-b border-zinc-800 px-4 py-2">
          {damageGateBlocked ? (
            <button
              type="button"
              onClick={() => setSheetView("dosar")}
              className="w-full rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-950/35"
            >
              Reparație (În lucru) blocată —{" "}
              {wo.damagePayerType === "client"
                ? "confirmă plătitorul client"
                : "Accept plată (pipeline)"}{" "}
              + mobilitate
              {wo.vehicleMovable === "immovable" ? " (+ asistență la recepție dacă e imobil)" : ""}.
              Deschide dosarul daună →
            </button>
          ) : !wo.damagePayerType ? (
            <button
              type="button"
              onClick={() => setSheetView("dosar")}
              className="w-full rounded-lg border border-sky-500/40 bg-sky-950/20 px-3 py-2 text-left text-xs text-sky-100 hover:bg-sky-950/35"
            >
              Alege plătitorul pe dosarul de daună →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSheetView("dosar")}
              className="text-xs text-zinc-500 hover:text-zinc-300 hover:underline"
            >
              Dosar daună
              {wo.damageCascoFranchiseCents != null
                ? ` · franciză ${(wo.damageCascoFranchiseCents / 100).toFixed(2)} RON`
                : ""}{" "}
              →
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-sm text-red-400">{error}</p> : null}

      <div className="grid border-b border-zinc-800 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className={panelClass()}>
          {panelTitle("Tranzacție")}
          <div className="space-y-1 text-xs text-zinc-300">
            <div>
              Comandă:{" "}
              <span className="font-mono font-medium text-violet-300">{workOrderDisplayLabel(wo)}</span>
            </div>
            {wo.sourceTicketId ? (
              <div>
                Referință{" "}
                {isPartner ? (
                  <span className="font-mono text-emerald-300">#{wo.ticketDisplayId}</span>
                ) : (
                  <Link href={`/fleet/tickets/${wo.sourceTicketId}`} className="text-emerald-400 hover:underline">
                    #{wo.ticketDisplayId}
                  </Link>
                )}
              </div>
            ) : null}
            {isPartner && wo.sourceTicketId ? (
              <div className="pt-1">
                <PartnerSourceTicketPanel workOrderId={wo.id} compact />
              </div>
            ) : null}
            <div>Programare: {fmtDate(wo.plannedAt ?? wo.linkedAppointmentScheduledAt)}</div>
            {wo.linkedAppointmentScheduledAt && wo.linkedAppointmentStatus ? (
              <div className="text-[11px] text-zinc-400">
                Status programare:{" "}
                <span className="text-amber-200/90">
                  {appointmentStatusLabel(wo.linkedAppointmentStatus)}
                </span>
              </div>
            ) : null}
            <div>
              Estimare finalizare:{" "}
              {wo.estimatedRepairAt ? (
                <span className="text-zinc-100">{formatDateRo(wo.estimatedRepairAt)}</span>
              ) : (
                <span className="text-amber-400/90">necompletată</span>
              )}
            </div>
            <div className="pt-1 font-semibold text-zinc-100">Total: {totalDisplay}</div>
          </div>
        </div>

        <div className={panelClass()}>
          {panelTitle("Vehicul + Client")}
          <dl className="space-y-1 text-xs">
            <Row
              label="Nr. înmatriculare"
              value={wo.vehicle.registrationNumber}
              href={!isPartner ? `/fleet/vehicles/${wo.vehicleId}` : null}
            />
            <Row
              label="Marcă / model"
              value={[wo.vehicle.brand, wo.vehicle.model].filter(Boolean).join(" ") || "—"}
            />
            <Row label="VIN / șasiu" value={wo.vehicle.vin ?? "—"} mono />
            <div className="grid grid-cols-[88px_1fr] gap-2">
              <dt className="text-zinc-500">Km flotă</dt>
              <dd className="text-zinc-200">
                {wo.vehicle.odometerKm.toLocaleString("ro-RO")} km
                {fleetOdoNotice || fleetAlignedFromService ? (
                  <span className="ml-1.5 inline-flex items-center rounded border border-emerald-800/50 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    actualizat
                  </span>
                ) : null}
              </dd>
            </div>
            {fleetOdoNotice ? (
              <p className="text-[10px] text-emerald-400/80">{fleetOdoNotice}</p>
            ) : fleetAlignedFromService ? (
              <p className="text-[10px] text-emerald-400/80">Odometru flotă actualizat din recepție service</p>
            ) : null}
            <Row label="ITP expiră" value={fmtItp(wo.vehicle.itpExpiresOn)} />
            <div className="my-2 border-t border-zinc-800" />
            <Row
              label="Denumire"
              value={wo.client.legalName}
              href={!isPartner ? `/fleet/clients/${wo.clientId}` : null}
            />
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
                <div className="font-medium text-zinc-100">
                  {!isPartner && wo.supplierId ? (
                    <Link
                      href={`/fleet/suppliers/${wo.supplierId}`}
                      className="text-sky-300 hover:underline"
                    >
                      {wo.supplier.legalName}
                    </Link>
                  ) : (
                    wo.supplier.legalName
                  )}
                </div>
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
          {hasLucrare2 ? (
            <div className="mb-2 flex flex-wrap gap-1 border-b border-zinc-800 pb-1">
              <button
                type="button"
                onClick={() => setTilaTrack(1)}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  tilaTrack === 1
                    ? "bg-violet-900/50 text-violet-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                L1
              </button>
              <button
                type="button"
                onClick={() => setTilaTrack(2)}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  tilaTrack === 2
                    ? "bg-violet-900/50 text-violet-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                L2
              </button>
            </div>
          ) : null}
          {tilaTrack === 2 && hasLucrare2 ? (
            <p className="mb-2 rounded border border-amber-800/40 bg-amber-950/25 px-2 py-1.5 text-[11px] text-amber-100">
              L2 activă — istoricul L1 rămâne pe tab-ul alăturat.
            </p>
          ) : wo.supplementRepairAt && !wo.readyAt && tilaTrack === 1 ? (
            <p className="mb-2 rounded border border-zinc-700/60 bg-zinc-900/50 px-2 py-1.5 text-[11px] text-zinc-400">
              L1 (istoric înghețat). Activă acum: L2.
            </p>
          ) : null}
          <ul className="space-y-1">
            {milestones.map((m) => {
              const dimHistory =
                tilaTrack === 1 && hasLucrare2 && Boolean(wo.supplementRepairAt || wo.lucrare1ReadyAt);
              return (
              <li
                key={m.id}
                className={`flex items-center gap-2 text-[11px] ${
                  dimHistory ? "opacity-60" : m.done || m.active ? "" : "opacity-50"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${
                    m.done ? "border-violet-500 bg-violet-600" : m.active ? "border-violet-400" : "border-zinc-600"
                  }`}
                />
                <span className={m.active ? "font-semibold text-zinc-100" : "text-zinc-300"}>
                  {m.label}
                </span>
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
            );
            })}
          </ul>
          {canStartNewLucrare ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void startSupplementRepair()}
              className="mt-2 w-full rounded border border-amber-700/50 px-2 py-1.5 text-[11px] text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
            >
              Lucrare nouă (L2)
            </button>
          ) : null}
          {isDamageWo ? (
            <p className="mt-2 text-[10px] leading-snug text-zinc-500">
              Daună: Verificare / Deviz urmează dosarul. Lucrare gata — bifează manual sau urcă poze
              «auto reparat» pe Dosar. După Lucrare gata pe L1: „Lucrare nouă” pentru L2, apoi Deviz pe
              L2.
            </p>
          ) : null}
        </div>

        <div className={panelClass()}>
          {panelTitle("Rezumat")}
          <div className="space-y-1 text-xs text-zinc-400">
            {wo.ticketSubject ? (
              <div>
                #{wo.ticketDisplayId}: {wo.ticketSubject}
              </div>
            ) : null}
            {isDamageWo ? (
              <div
                className={
                  wo.damageEventOn
                    ? ""
                    : "rounded border border-amber-800/40 bg-amber-950/20 px-2 py-1.5"
                }
              >
                Data eveniment:{" "}
                {wo.damageEventOn ? (
                  <span className="text-zinc-200">{formatDateRo(wo.damageEventOn)}</span>
                ) : (
                  <span className="text-amber-300">necompletată — completează pe Dosar daună</span>
                )}
                {" · "}
                <button
                  type="button"
                  onClick={() => setSheetView("dosar")}
                  className="text-sky-300 hover:underline"
                >
                  editează pe Dosar
                </button>
              </div>
            ) : null}
            {wo.driverName ? (
              <div>
                Șofer:{" "}
                {!isPartner && wo.driverId ? (
                  <Link href={`/fleet/drivers/${wo.driverId}`} className="text-sky-300 hover:underline">
                    {wo.driverName}
                  </Link>
                ) : (
                  wo.driverName
                )}
                {wo.driverPhone ? ` · ${wo.driverPhone}` : ""}
              </div>
            ) : null}
            {error ? <p className="pt-1 text-red-400">{error}</p> : null}
            {fleetOdoNotice ? (
              <p className="pt-1 text-[11px] text-emerald-400/90">{fleetOdoNotice}</p>
            ) : null}

            <div className="flex flex-wrap gap-1 border-b border-zinc-800 pb-1 pt-2">
              {(
                [
                  { id: "v1", label: "Vizită 1" },
                  { id: "v1-in", label: "Poze IN" },
                  { id: "v1-out", label: "Poze OUT" },
                  ...(useVisit2
                    ? [
                        { id: "v2", label: "Vizită 2" },
                        { id: "v2-in", label: "Poze IN 2" },
                        { id: "v2-out", label: "Poze OUT 2" },
                      ]
                    : []),
                  ...extraVisits.flatMap((v) => [
                    { id: `vx-${v.n}`, label: `Vizită ${v.n}` },
                    { id: `vx-${v.n}-in`, label: `IN ${v.n}` },
                    { id: `vx-${v.n}-out`, label: `OUT ${v.n}` },
                  ]),
                ] as { id: string; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRezumatTab(t.id)}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    rezumatTab === t.id
                      ? "bg-violet-900/50 text-violet-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {rezumatTab === "v1" ? (
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-zinc-500">
                  Km in{requireKm ? <span className="text-amber-400"> *</span> : null}
                  <input
                    type="number"
                    min={0}
                    value={kmIn}
                    disabled={!canWrite || pending || !!wo.inServiceAt}
                    onChange={(e) => setKmIn(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                    placeholder={requireKm ? "Obligatoriu" : "Opțional"}
                  />
                </label>
                {wo.inServiceAt ? (
                  <p className="text-[10px] text-zinc-500">
                    In service: {new Date(wo.inServiceAt).toLocaleString("ro-RO")}
                  </p>
                ) : canWrite ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void markIn()}
                    className="w-full rounded-lg bg-violet-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    In service
                  </button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label className="block text-zinc-500">
                  Km out{requireKm ? <span className="text-amber-400"> *</span> : null}
                  <input
                    type="number"
                    min={0}
                    value={kmOut}
                    disabled={!canWrite || pending || !wo.inServiceAt || !!wo.outServiceAt}
                    onChange={(e) => setKmOut(e.target.value)}
                    className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                    placeholder={requireKm ? "Obligatoriu" : "Opțional"}
                  />
                </label>
                {wo.outServiceAt ? (
                  <p className="text-[10px] text-zinc-500">
                    Out service: {new Date(wo.outServiceAt).toLocaleString("ro-RO")}
                  </p>
                ) : canWrite && wo.inServiceAt ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void markOut()}
                    className="w-full rounded-lg border border-violet-500/50 bg-violet-950/40 px-2 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
                  >
                    Out service
                  </button>
                ) : null}
              </div>
            </div>
            ) : null}

            {rezumatTab === "v1-in" ? (
              <div className="pt-2">
                <WorkOrderPhotoGallery
                  workOrderId={wo.id}
                  canWrite={canWrite}
                  mode="visit"
                  visitIndex={1}
                  phase="in"
                  title="Poze intrare — vizită 1"
                />
              </div>
            ) : null}
            {rezumatTab === "v1-out" ? (
              <div className="pt-2">
                <WorkOrderPhotoGallery
                  workOrderId={wo.id}
                  canWrite={canWrite}
                  mode="visit"
                  visitIndex={1}
                  phase="out"
                  title="Poze ieșire — vizită 1"
                />
              </div>
            ) : null}

            {rezumatTab === "v2" && useVisit2 ? (
              <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                  Vizită 2 — reparație
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-zinc-500">
                      Km in V2{requireKm ? <span className="text-amber-400"> *</span> : null}
                      <input
                        type="number"
                        min={0}
                        value={kmIn2}
                        disabled={!canWrite || pending || !!wo.visit2InServiceAt}
                        onChange={(e) => setKmIn2(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                      />
                    </label>
                    {wo.visit2InServiceAt ? (
                      <p className="text-[10px] text-zinc-500">
                        In: {new Date(wo.visit2InServiceAt).toLocaleString("ro-RO")}
                      </p>
                    ) : canWrite ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void markIn()}
                        className="w-full rounded-lg bg-amber-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        In service (V2)
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-zinc-500">
                      Km out V2{requireKm ? <span className="text-amber-400"> *</span> : null}
                      <input
                        type="number"
                        min={0}
                        value={kmOut2}
                        disabled={!canWrite || pending || !wo.visit2InServiceAt || !!wo.visit2OutServiceAt}
                        onChange={(e) => setKmOut2(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                      />
                    </label>
                    {wo.visit2OutServiceAt ? (
                      <p className="text-[10px] text-zinc-500">
                        Out: {new Date(wo.visit2OutServiceAt).toLocaleString("ro-RO")}
                      </p>
                    ) : canWrite && wo.visit2InServiceAt ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void markOut()}
                        className="w-full rounded-lg border border-amber-500/50 bg-amber-950/40 px-2 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
                      >
                        Out service (V2)
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {rezumatTab === "v2-in" && useVisit2 ? (
              <div className="pt-2">
                <WorkOrderPhotoGallery
                  workOrderId={wo.id}
                  canWrite={canWrite}
                  mode="visit"
                  visitIndex={2}
                  phase="in"
                  title="Poze intrare — vizită 2"
                />
              </div>
            ) : null}
            {rezumatTab === "v2-out" && useVisit2 ? (
              <div className="pt-2">
                <WorkOrderPhotoGallery
                  workOrderId={wo.id}
                  canWrite={canWrite}
                  mode="visit"
                  visitIndex={2}
                  phase="out"
                  title="Poze ieșire — vizită 2"
                />
              </div>
            ) : null}

            {extraVisits.map((v) => {
              if (rezumatTab !== `vx-${v.n}`) return null;
              const km = extraKm[v.n] ?? { in: "", out: "" };
              return (
                <div key={v.n} className="mt-3 space-y-2 rounded-lg border border-sky-500/30 bg-sky-950/20 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/90">
                    Vizită {v.n}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-zinc-500">
                        Km in V{v.n}
                        {requireKm ? <span className="text-amber-400"> *</span> : null}
                        <input
                          type="number"
                          min={0}
                          value={km.in}
                          disabled={!canWrite || pending || !!v.inServiceAt}
                          onChange={(e) =>
                            setExtraKm((prev) => ({
                              ...prev,
                              [v.n]: { in: e.target.value, out: prev[v.n]?.out ?? km.out },
                            }))
                          }
                          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                        />
                      </label>
                      {v.inServiceAt ? (
                        <p className="text-[10px] text-zinc-500">
                          In: {new Date(v.inServiceAt).toLocaleString("ro-RO")}
                        </p>
                      ) : canWrite ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void markExtraIn(v.n)}
                          className="w-full rounded-lg bg-sky-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                        >
                          In service (V{v.n})
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-zinc-500">
                        Km out V{v.n}
                        {requireKm ? <span className="text-amber-400"> *</span> : null}
                        <input
                          type="number"
                          min={0}
                          value={km.out}
                          disabled={!canWrite || pending || !v.inServiceAt || !!v.outServiceAt}
                          onChange={(e) =>
                            setExtraKm((prev) => ({
                              ...prev,
                              [v.n]: { in: prev[v.n]?.in ?? km.in, out: e.target.value },
                            }))
                          }
                          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                        />
                      </label>
                      {v.outServiceAt ? (
                        <p className="text-[10px] text-zinc-500">
                          Out: {new Date(v.outServiceAt).toLocaleString("ro-RO")}
                        </p>
                      ) : canWrite && v.inServiceAt ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void markExtraOut(v.n)}
                          className="w-full rounded-lg border border-sky-500/50 bg-sky-950/40 px-2 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
                        >
                          Out service (V{v.n})
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {extraVisits.map((v) =>
              rezumatTab === `vx-${v.n}-in` ? (
                <div key={`in-${v.n}`} className="pt-2">
                  <WorkOrderPhotoGallery
                    workOrderId={wo.id}
                    canWrite={canWrite}
                    mode="visit"
                    visitIndex={v.n}
                    phase="in"
                    title={`Poze intrare — vizită ${v.n}`}
                  />
                </div>
              ) : rezumatTab === `vx-${v.n}-out` ? (
                <div key={`out-${v.n}`} className="pt-2">
                  <WorkOrderPhotoGallery
                    workOrderId={wo.id}
                    canWrite={canWrite}
                    mode="visit"
                    visitIndex={v.n}
                    phase="out"
                    title={`Poze ieșire — vizită ${v.n}`}
                  />
                </div>
              ) : null,
            )}

            {canWrite &&
            (rezumatTab === "v1" || rezumatTab === "v2" || rezumatTab.startsWith("vx-")) &&
            !rezumatTab.includes("-in") &&
            !rezumatTab.includes("-out") &&
            wo.outServiceAt &&
            !(wo.visit2InServiceAt && !wo.visit2OutServiceAt) ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void addExtraVisit()}
                className="mt-3 w-full rounded-lg border border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Adaugă vizită
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {wo.awaitingPostApproval || wo.postApprovalPath ? (
        <div className="border-b border-zinc-800 bg-zinc-950/60 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Decizie după aprobare deviz
          </p>
          {wo.awaitingPostApproval && canWrite ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void applyPostApproval("immediate")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Continuă reparația
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void applyPostApproval("reschedule")}
                className="rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/50 disabled:opacity-50"
              >
                Programează din nou
              </button>
              <span className="text-[10px] text-zinc-500">Flotă sau partener</span>
            </div>
          ) : wo.postApprovalPath === "immediate" ? (
            <p className="mt-1 text-xs text-emerald-200">
              {wo.repairPathNote ?? "Reparație directă — devizul rămâne pe comandă"}
            </p>
          ) : wo.postApprovalPath === "reschedule" ? (
            <div className="mt-1 space-y-2">
              <p className="text-xs text-amber-100">
                {wo.repairPathNote ?? "Reprogramare — devizul aprobat rămâne valid"}
              </p>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-zinc-200">
                {wo.linkedAppointmentScheduledAt ? (
                  <>
                    <p>
                      Propunere programare:{" "}
                      <span className="font-medium text-zinc-50">
                        {fmtDate(wo.linkedAppointmentScheduledAt)}
                      </span>
                      {wo.linkedAppointmentStatus ? (
                        <>
                          {" · "}
                          <span className="text-amber-200">
                            {appointmentStatusLabel(wo.linkedAppointmentStatus)}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {wo.linkedAppointmentStatus === "pending_supplier"
                        ? "Așteaptă validarea partenerului sau o propunere alternativă de dată."
                        : wo.linkedAppointmentStatus === "scheduled"
                          ? "Validat de partener — așteaptă confirmarea managerului."
                          : "Deschide programatorul pentru detalii / acțiuni."}
                    </p>
                  </>
                ) : (
                  <p className="text-amber-100/90">
                    Nu există încă o programare legată — creează sau alege una din calendar.
                  </p>
                )}
                <p className="mt-2">
                  <Link
                    href={schedulerLink}
                    className="font-medium text-sky-300 hover:underline"
                  >
                    {wo.linkedAppointmentId
                      ? "Deschide programarea în calendar →"
                      : "Solicită programare la furnizor →"}
                  </Link>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleOpen((v) => !v)}
                className="text-xs text-zinc-500 hover:text-zinc-300 hover:underline"
              >
                {rescheduleOpen ? "Ascunde detalii ▴" : "Detalii reprogramare ▾"}
              </button>
              {rescheduleOpen ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                  <p>
                    Partenerul validează propunerea (Validează) sau propune altă dată; după confirmare
                    duală folosești km In/Out vizită 2 pe această comandă.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <WorkOrderQuotePanel
        workOrderId={wo.id}
        canWrite={canWrite}
        canApprove={canApprove}
        canResubmitQuote={canResubmitQuote}
        canMoveQuote={canWrite}
        canPostCost={canWrite && !isPartner}
        isPartner={isPartner}
        sheetLayout
        hasLucrare2={hasLucrare2}
        lucrareTrack={tilaTrack}
        onLucrareTrackChange={setTilaTrack}
        canStartNewLucrare={canStartNewLucrare}
        onStartNewLucrare={() => void startSupplementRepair()}
        estimatedRepairAt={wo.estimatedRepairAt}
        quoteLocked={false}
        workOrderStatus={wo.status}
        outServiceAt={wo.outServiceAt}
        requirePartCode={workOrderSettings.requirePartCode}
        allowQuotePdfImport={workOrderSettings.allowQuotePdfImport}
        allowPartsPriceVerify={workOrderSettings.allowPartsPriceVerify}
        allowPartsOrderLaunch={workOrderSettings.allowPartsOrderLaunch}
        quoteInvoiceMode={workOrderSettings.quoteInvoiceMode ?? "per_quote"}
        canLaunchPartsOrders={isPartner ? canWrite : canApprove}
        ticketSettlement={ticketSettlement}
        supplierDiscounts={
          wo.supplier
            ? {
                partsDiscountPercent: wo.supplier.partsDiscountPercent ?? 0,
                laborDiscountPercent: wo.supplier.laborDiscountPercent ?? 0,
              }
            : null
        }
      />

      <div className="border-t border-zinc-800 p-4">
        <WorkOrderMessageThread workOrderId={wo.id} canWrite={canWrite || canApprove} isPartner={isPartner} />
      </div>

      <div className="border-t border-zinc-800 px-4 py-3">
        <WorkOrderCompleteButton
          workOrderId={wo.id}
          canWrite={canWrite}
          status={wo.status}
          serviceCaseStatus={wo.serviceCaseStatus}
          outServiceDone={outServiceDone}
          hasInvoicedQuote={hasInvoicedQuote}
          hasCostFromQuote={hasCostFromQuote || wo.hasQuoteCost}
          ticketSettlement={ticketSettlement}
          isPartner={isPartner}
        />
      </div>
        </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  href?: string | null;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`${mono ? "font-mono" : ""} ${href ? "" : "text-zinc-200"}`}>
        {href ? (
          <Link href={href} className="text-sky-300 hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
