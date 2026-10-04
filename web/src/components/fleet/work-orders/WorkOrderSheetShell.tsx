"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { PartnerVehicleHistoryPanel } from "@/components/fleet/partner/PartnerVehicleHistoryPanel";
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
  type ServiceTypeSettingsKey,
  type WorkOrderSettings,
} from "@/lib/work-order-settings";
import { useT } from "@/lib/i18n/useT";

type Props = {
  wo: WorkOrderDetail;
  canWrite: boolean;
  /**
   * Marcă Out service (+ km/poze). Implicit = canWrite.
   * Șofer: true când Setup WO → allowDriverServiceOut.
   */
  canMarkServiceOut?: boolean;
  canApprove: boolean;
  /** Retrimite spre aprobare — partener sau tenant_admin (nu manager L1). */
  canResubmitQuote?: boolean;
  hasInvoicedQuote: boolean;
  hasCostFromQuote: boolean;
  isPartner?: boolean;
  /** Furnizor partener (prefill rent pe predare mobilitate). */
  partnerSupplierId?: string | null;
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
  canMarkServiceOut: canMarkServiceOutProp,
  canApprove,
  canResubmitQuote = false,
  hasInvoicedQuote,
  hasCostFromQuote,
  isPartner = false,
  partnerSupplierId,
  workOrderSettings = DEFAULT_WORK_ORDER_SETTINGS,
}: Props) {
  const tx = useT();
  const woT = (key: string) => tx(`ops.workOrders.sheet.${key}`);
  const canMarkServiceOut = canMarkServiceOutProp ?? canWrite;
  const mobilityPrefillSupplierId = partnerSupplierId?.trim() || (isPartner ? wo.supplierId : null);
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceOrderType>(wo.serviceOrderType);
  const [workshopStatusCode, setWorkshopStatusCode] = useState<string>(
    wo.workshopStatusCode ?? "",
  );
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
  const [visitPane, setVisitPane] = useState<"details" | "in" | "out">("details");
  const [tilaTrack, setTilaTrack] = useState<1 | 2>(1);
  /** Dosar pe WO: același ServiceCase ca pe tichet (nu mapare parțială din WO). */
  const [dosarServiceCase, setDosarServiceCase] = useState<ServiceCaseRecord | null>(null);
  const requireKm = workOrderSettings.requireServiceKm;
  const typeSettingsKey =
    serviceType === "M" || serviceType === "E" || serviceType === "TV"
      ? (serviceType as ServiceTypeSettingsKey)
      : null;
  const typeSettings = typeSettingsKey
    ? workOrderSettings.serviceTypeSettings[typeSettingsKey]
    : null;
  const workshopStatuses = (typeSettings?.workshopStatuses ?? []).filter((s) => s.enabled);
  const requirePhotosIn = typeSettings?.requirePhotosIn ?? false;
  const requirePhotosOut = typeSettings?.requirePhotosOut ?? false;
  const isDamageWo = wo.workflowType === "damage";

  useEffect(() => {
    setWorkshopStatusCode(wo.workshopStatusCode ?? "");
  }, [wo.workshopStatusCode, wo.id]);

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

  const visitOptions = useMemo(() => {
    const opts: { n: number; label: string }[] = [{ n: 1, label: woT("visit.one") }];
    if (useVisit2) opts.push({ n: 2, label: woT("visit.twoRepair") });
    for (const v of extraVisits) {
      opts.push({ n: v.n, label: woT("visit.number").replace("{n}", String(v.n)) });
    }
    return opts;
  }, [useVisit2, extraVisits, tx]);

  const latestVisitN = visitOptions[visitOptions.length - 1]!.n;
  const [selectedVisit, setSelectedVisit] = useState(() => {
    for (let i = extraVisits.length - 1; i >= 0; i--) {
      const v = extraVisits[i]!;
      if (v.inServiceAt && !v.outServiceAt) return v.n;
    }
    for (let i = extraVisits.length - 1; i >= 0; i--) {
      if (!extraVisits[i]!.inServiceAt) return extraVisits[i]!.n;
    }
    if (useVisit2 && !wo.visit2OutServiceAt) return 2;
    return latestVisitN;
  });
  const prevLatestVisitRef = useRef(latestVisitN);

  useEffect(() => {
    if (latestVisitN > prevLatestVisitRef.current) {
      setSelectedVisit(latestVisitN);
      setVisitPane("details");
    } else if (!visitOptions.some((o) => o.n === selectedVisit)) {
      setSelectedVisit(latestVisitN);
    }
    prevLatestVisitRef.current = latestVisitN;
  }, [latestVisitN, visitOptions, selectedVisit]);

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
            woT("messages.fleetOdometerUpdatedFromTo")
              .replace("{previous}", j.fleetOdometerUpdate.previousKm.toLocaleString("ro-RO"))
              .replace("{next}", j.fleetOdometerUpdate.newKm.toLocaleString("ro-RO")),
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

  async function countVisitPhotos(visitIndex: number, phase: "in" | "out"): Promise<number> {
    try {
      const q = new URLSearchParams({
        kind: "condition",
        visitIndex: String(visitIndex),
        phase,
      });
      const res = await fetch(`${workOrdersBrowserBase}/${wo.id}/photos?${q}`, {
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) return 0;
      const data = (await res.json()) as unknown[];
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  }

  async function markIn() {
    const visitIndex = useVisit2 ? 2 : 1;
    if (requirePhotosIn) {
      const n = await countVisitPhotos(visitIndex, "in");
      if (n < 1) {
        setError(woT("errors.photosInRequired"));
        setSelectedVisit(useVisit2 ? 2 : 1);
        setVisitPane("in");
        return;
      }
    }
    const body: Record<string, string | number> = { inServiceAt: new Date().toISOString() };
    const kmVal = useVisit2 ? kmIn2 : kmIn;
    if (kmVal.trim()) {
      const n = parseInt(kmVal, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError(woT("errors.invalidKmIn"));
        return;
      }
      body.odometerKmIn = n;
    } else if (requireKm) {
      setError(woT("errors.kmInRequired"));
      return;
    }
    await patchServiceTimes(body);
  }

  async function markOut() {
    const visitIndex = useVisit2 ? 2 : 1;
    if (requirePhotosOut) {
      const n = await countVisitPhotos(visitIndex, "out");
      if (n < 1) {
        setError(woT("errors.photosOutRequired"));
        setSelectedVisit(useVisit2 ? 2 : 1);
        setVisitPane("out");
        return;
      }
    }
    const body: Record<string, string | number> = { outServiceAt: new Date().toISOString() };
    const kmVal = useVisit2 ? kmOut2 : kmOut;
    if (kmVal.trim()) {
      const n = parseInt(kmVal, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError(woT("errors.invalidKmOut"));
        return;
      }
      body.odometerKmOut = n;
    } else if (requireKm) {
      setError(woT("errors.kmOutRequired"));
      return;
    }
    await patchServiceTimes(body);
  }

  async function markExtraIn(n: number) {
    if (requirePhotosIn) {
      const count = await countVisitPhotos(n, "in");
      if (count < 1) {
        setError(woT("errors.visitPhotosInRequired").replace("{n}", String(n)));
        setSelectedVisit(n);
        setVisitPane("in");
        return;
      }
    }
    const body: Record<string, string | number> = {
      visitIndex: n,
      inServiceAt: new Date().toISOString(),
    };
    const kmVal = extraKm[n]?.in ?? "";
    if (kmVal.trim()) {
      const km = parseInt(kmVal, 10);
      if (!Number.isFinite(km) || km < 0) {
        setError(woT("errors.invalidKmIn"));
        return;
      }
      body.odometerKmIn = km;
    } else if (requireKm) {
      setError(woT("errors.kmInRequired"));
      return;
    }
    await patchServiceTimes(body);
  }

  async function markExtraOut(n: number) {
    if (requirePhotosOut) {
      const count = await countVisitPhotos(n, "out");
      if (count < 1) {
        setError(woT("errors.visitPhotosOutRequired").replace("{n}", String(n)));
        setSelectedVisit(n);
        setVisitPane("out");
        return;
      }
    }
    const body: Record<string, string | number> = {
      visitIndex: n,
      outServiceAt: new Date().toISOString(),
    };
    const kmVal = extraKm[n]?.out ?? "";
    if (kmVal.trim()) {
      const km = parseInt(kmVal, 10);
      if (!Number.isFinite(km) || km < 0) {
        setError(woT("errors.invalidKmOut"));
        return;
      }
      body.odometerKmOut = km;
    } else if (requireKm) {
      setError(woT("errors.kmOutRequired"));
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
      setWorkshopStatusCode("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  async function changeWorkshopStatus(code: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${wo.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ workshopStatusCode: code || null }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setWorkshopStatusCode(code);
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
        { label: woT("nav.inbox"), href: "/fleet/partner/work-orders" },
        { label: woT("nav.scheduler"), href: schedulerLink },
      ]
    : [
        { label: woT("nav.inbox"), href: "/fleet/work-orders" },
        { label: woT("nav.vehicle"), href: `/fleet/vehicles/${wo.vehicleId}` },
        { label: woT("nav.scheduler"), href: schedulerLink },
        ...(wo.sourceTicketId
          ? [{ label: woT("nav.ticket"), href: `/fleet/tickets/${wo.sourceTicketId}` }]
          : []),
      ];

  const toolbarGroups = [
    {
      label: woT("tabs.order"),
      items: [] as { label: string; href?: string; onClick?: () => void }[],
    },
    { label: woT("toolbar.navigation"), items: navActions },
  ];

  return (
    <div className="space-y-0 rounded-xl border border-zinc-700 bg-zinc-950/80">
      <div className="overflow-x-auto border-b border-zinc-800 bg-zinc-900/60 px-2 py-2">
        <div className={`grid min-w-[640px] gap-1.5 ${isDamageWo ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
          {toolbarGroups.map((g) => {
            if (g.label === woT("tabs.order")) {
              return (
                <div
                  key={g.label}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 pt-1.5"
                >
                  <div className="mb-0 px-1 text-[9px] font-semibold uppercase text-zinc-500">
                    {woT("tabs.order")}
                  </div>
                  <nav className="border-b border-zinc-800">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setSheetView("comanda")}
                        className={fleetSheetTabClass(sheetView === "comanda")}
                      >
                        {woT("tabs.order")}
                      </button>
                      {isDamageWo ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setSheetView("dosar")}
                          className={fleetSheetTabClass(sheetView === "dosar")}
                        >
                          {woT("tabs.claimFile")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setSheetView("mobilitate")}
                        className={fleetSheetTabClass(sheetView === "mobilitate")}
                      >
                        {woT("tabs.mobility")}
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
                  {g.items.length === 0 && g.label === woT("tabs.order") ? (
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
                  {woT("labels.quoteTotal")} <span className="font-mono text-zinc-200">{totalDisplay}</span>
                </span>
              </div>
              <span className="flex items-center gap-1 text-xs font-normal text-zinc-400">
                {woT("labels.type")}:
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
              {workshopStatuses.length > 0 ? (
                <label className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span>{woT("labels.workshop")}:</span>
                  <select
                    value={workshopStatusCode}
                    disabled={!canWrite || pending}
                    onChange={(e) => void changeWorkshopStatus(e.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-200 disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {workshopStatuses.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {(requirePhotosIn || requirePhotosOut) && !outServiceDone ? (
                <p className="mt-1 text-[11px] text-amber-200/80">
                  {requirePhotosIn && requirePhotosOut
                    ? woT("messages.photosInOutRequired")
                    : requirePhotosIn
                      ? woT("messages.photosInRequired")
                      : woT("messages.photosOutRequired")}
                </p>
              ) : null}
            </>
          ) : sheetView === "mobilitate" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>{woT("labels.mobilityReplacement")}</span>
              <span>·</span>
              <span>{wo.registrationNumber}</span>
              <button
                type="button"
                onClick={() => setSheetView("comanda")}
                className="text-sky-300 hover:underline"
              >
                {woT("actions.backToOrder")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>{woT("tabs.claimFile")}</span>
              <span>·</span>
              <span>{wo.registrationNumber}</span>
              <button
                type="button"
                onClick={() => setSheetView("comanda")}
                className="text-sky-300 hover:underline"
              >
                {woT("actions.backToOrder")}
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
          <WorkOrderMobilitySummary workOrderId={wo.id} canWrite={canWrite} partnerMode={isPartner} />
          {canWrite ? (
            <MobilityAssignmentForm
              workOrderId={wo.id}
              embedded
              partnerMode={isPartner}
              prefillSupplierId={mobilityPrefillSupplierId}
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
            <p className="text-sm text-zinc-500">{woT("messages.noAllocationPermission")}</p>
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
      <WorkOrderMobilitySummary workOrderId={wo.id} canWrite={canWrite} partnerMode={isPartner} />

      {isDamageWo ? (
        <div className="border-b border-zinc-800 px-4 py-2">
          {damageGateBlocked ? (
            <button
              type="button"
              onClick={() => setSheetView("dosar")}
              className="w-full rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-950/35"
            >
              {woT("damage.repairBlocked")}{" "}
              {wo.damagePayerType === "client"
                ? woT("damage.confirmClientPayer")
                : woT("damage.acceptPaymentPipeline")}{" "}
              + {woT("tabs.mobility").toLowerCase()}
              {wo.vehicleMovable === "immovable" ? ` ${woT("damage.roadsideReceptionSuffix")}` : ""}.
              {woT("damage.openClaimFile")}
            </button>
          ) : !wo.damagePayerType ? (
            <button
              type="button"
              onClick={() => setSheetView("dosar")}
              className="w-full rounded-lg border border-sky-500/40 bg-sky-950/20 px-3 py-2 text-left text-xs text-sky-100 hover:bg-sky-950/35"
            >
              {woT("damage.choosePayer")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSheetView("dosar")}
              className="text-xs text-zinc-500 hover:text-zinc-300 hover:underline"
            >
              {woT("tabs.claimFile")}
              {wo.damageCascoFranchiseCents != null
                ? ` · ${woT("damage.franchise")} ${(wo.damageCascoFranchiseCents / 100).toFixed(2)} RON`
                : ""}{" "}
              →
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-sm text-red-400">{error}</p> : null}

      <div className="grid border-b border-zinc-800 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className={panelClass()}>
          {panelTitle(woT("panels.transaction"))}
          <div className="space-y-1 text-xs text-zinc-300">
            <div>
              {woT("labels.order")}:{" "}
              <span className="font-mono font-medium text-violet-300">{workOrderDisplayLabel(wo)}</span>
            </div>
            {wo.sourceTicketId ? (
              <div>
                {woT("labels.reference")}{" "}
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
            <div>{woT("labels.appointment")}: {fmtDate(wo.plannedAt ?? wo.linkedAppointmentScheduledAt)}</div>
            {wo.linkedAppointmentScheduledAt && wo.linkedAppointmentStatus ? (
              <div className="text-[11px] text-zinc-400">
                {woT("labels.appointmentStatus")}:{" "}
                <span className="text-amber-200/90">
                  {appointmentStatusLabel(wo.linkedAppointmentStatus)}
                </span>
              </div>
            ) : null}
            <div>
              {woT("labels.estimatedCompletion")}:{" "}
              {wo.estimatedRepairAt ? (
                <span className="text-zinc-100">{formatDateRo(wo.estimatedRepairAt)}</span>
              ) : (
                <span className="text-amber-400/90">{woT("status.missing")}</span>
              )}
            </div>
            <div className="pt-1 font-semibold text-zinc-100">{woT("labels.total")}: {totalDisplay}</div>
          </div>
        </div>

        <div className={panelClass()}>
          {panelTitle(woT("panels.vehicleClient"))}
          <dl className="space-y-1 text-xs">
            <Row
              label={woT("labels.registrationNumber")}
              value={wo.vehicle.registrationNumber}
              href={!isPartner ? `/fleet/vehicles/${wo.vehicleId}` : null}
            />
            <Row
              label={woT("labels.brandModel")}
              value={[wo.vehicle.brand, wo.vehicle.model].filter(Boolean).join(" ") || "—"}
            />
            <Row label={woT("labels.vin")} value={wo.vehicle.vin ?? "—"} mono />
            <div className="grid grid-cols-[88px_1fr] gap-2">
              <dt className="text-zinc-500">{woT("labels.fleetKm")}</dt>
              <dd className="text-zinc-200">
                {wo.vehicle.odometerKm.toLocaleString("ro-RO")} km
                {fleetOdoNotice || fleetAlignedFromService ? (
                  <span className="ml-1.5 inline-flex items-center rounded border border-emerald-800/50 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    {woT("status.updated")}
                  </span>
                ) : null}
              </dd>
            </div>
            {fleetOdoNotice ? (
              <p className="text-[10px] text-emerald-400/80">{fleetOdoNotice}</p>
            ) : fleetAlignedFromService ? (
              <p className="text-[10px] text-emerald-400/80">{woT("messages.fleetOdometerUpdated")}</p>
            ) : null}
            <Row label={woT("labels.itpExpires")} value={fmtItp(wo.vehicle.itpExpiresOn)} />
            <div className="my-2 border-t border-zinc-800" />
            <Row
              label={woT("labels.legalName")}
              value={wo.client.legalName}
              href={!isPartner ? `/fleet/clients/${wo.clientId}` : null}
            />
            <Row label={woT("labels.taxId")} value={wo.client.taxId ?? "—"} />
            <Row label={woT("labels.address")} value={wo.client.addressLine ?? "—"} />
            <Row
              label={woT("labels.contact")}
              value={[wo.client.contactPhone, wo.client.contactEmail].filter(Boolean).join(" · ") || "—"}
            />
            <Row label={woT("labels.groupContract")} value={wo.client.billingNotes ?? "—"} />
          </dl>
          {isPartner && wo.vehicleId ? (
            <PartnerVehicleHistoryPanel
              vehicleId={wo.vehicleId}
              currentWorkOrderId={wo.id}
            />
          ) : null}
          <p className="mt-2 text-[10px] text-zinc-600">{woT("messages.readOnlyMasterData")}</p>
        </div>

        <div className={panelClass()}>
          {panelTitle(woT("panels.partnerResponsible"))}
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
                <div className="text-[10px] uppercase text-zinc-500">{woT("labels.serviceContact")}</div>
                <div className="text-zinc-400">{woT("messages.assignedCoordinator")}</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">{woT("messages.noSupplier")}</p>
          )}
        </div>

        <div className={`${panelClass()} bg-zinc-900/40`}>
          {panelTitle(woT("panels.status"))}
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
              {woT("messages.l2Active")}
            </p>
          ) : wo.supplementRepairAt && !wo.readyAt && tilaTrack === 1 ? (
            <p className="mb-2 rounded border border-zinc-700/60 bg-zinc-900/50 px-2 py-1.5 text-[11px] text-zinc-400">
              {woT("messages.l1Frozen")}
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
                    {woT("actions.check")}
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
              {woT("actions.newWorkL2")}
            </button>
          ) : null}
          {isDamageWo ? (
            <p className="mt-2 text-[10px] leading-snug text-zinc-500">
              {woT("messages.damageFlowHint")}
            </p>
          ) : null}
        </div>

        <div className={panelClass()}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{woT("panels.summary")}</div>
            {canWrite &&
            wo.outServiceAt &&
            !(wo.visit2InServiceAt && !wo.visit2OutServiceAt) ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void addExtraVisit()}
                className="shrink-0 rounded border border-zinc-600 px-2 py-0.5 text-[10px] font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {woT("actions.addVisit")}
              </button>
            ) : null}
          </div>
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
                {woT("damage.eventDate")}:{" "}
                {wo.damageEventOn ? (
                  <span className="text-zinc-200">{formatDateRo(wo.damageEventOn)}</span>
                ) : (
                  <span className="text-amber-300">{woT("damage.eventDateMissing")}</span>
                )}
                {" · "}
                <button
                  type="button"
                  onClick={() => setSheetView("dosar")}
                  className="text-sky-300 hover:underline"
                >
                  {woT("damage.editOnClaim")}
                </button>
              </div>
            ) : null}
            {wo.driverName ? (
              <div>
                {woT("labels.driver")}:{" "}
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

            {/* O singură vizită activă — selector când există mai multe */}
            <div className="pt-2">
              {visitOptions.length > 1 ? (
                <label className="mb-1.5 block text-[10px] text-zinc-500">
                  {woT("visit.label")}
                  <select
                    value={selectedVisit}
                    onChange={(e) => {
                      setSelectedVisit(Number(e.target.value));
                      setVisitPane("details");
                    }}
                    className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
                  >
                    {visitOptions.map((o) => (
                      <option key={o.n} value={o.n}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="flex flex-wrap gap-1 border-b border-zinc-800 pb-1">
                {(
                  [
                    { id: "details" as const, label: selectedVisit === 1 ? woT("visit.one") : woT("visit.number").replace("{n}", String(selectedVisit)) },
                    { id: "in" as const, label: woT("visit.photosIn") },
                    { id: "out" as const, label: woT("visit.photosOut") },
                  ]
                ).map((t) => {
                  const activeTone =
                    selectedVisit === 2
                      ? "bg-amber-900/50 text-amber-100"
                      : selectedVisit >= 3
                        ? "bg-sky-900/50 text-sky-100"
                        : "bg-violet-900/50 text-violet-100";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setVisitPane(t.id)}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        visitPane === t.id ? activeTone : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {visitPane === "in" ? (
                <div className="pt-2">
                  <WorkOrderPhotoGallery
                    workOrderId={wo.id}
                    canWrite={canWrite}
                    mode="visit"
                    visitIndex={selectedVisit}
                    phase="in"
                    title={woT("visit.photosInTitle").replace("{n}", String(selectedVisit))}
                  />
                </div>
              ) : visitPane === "out" ? (
                <div className="pt-2">
                  <WorkOrderPhotoGallery
                    workOrderId={wo.id}
                    canWrite={selectedVisit === 1 ? canMarkServiceOut : canWrite}
                    mode="visit"
                    visitIndex={selectedVisit}
                    phase="out"
                    title={woT("visit.photosOutTitle").replace("{n}", String(selectedVisit))}
                  />
                </div>
              ) : selectedVisit === 1 ? (
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
                        placeholder={requireKm ? woT("placeholders.required") : woT("placeholders.optional")}
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
                        disabled={!canMarkServiceOut || pending || !wo.inServiceAt || !!wo.outServiceAt}
                        onChange={(e) => setKmOut(e.target.value)}
                        className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                        placeholder={requireKm ? woT("placeholders.required") : woT("placeholders.optional")}
                      />
                    </label>
                    {wo.outServiceAt ? (
                      <p className="text-[10px] text-zinc-500">
                        Out service: {new Date(wo.outServiceAt).toLocaleString("ro-RO")}
                      </p>
                    ) : canMarkServiceOut && wo.inServiceAt ? (
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
              ) : selectedVisit === 2 && useVisit2 ? (
                <div className="mt-2 space-y-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                    {woT("visit.twoRepair")}
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
                          disabled={
                            !canMarkServiceOut ||
                            pending ||
                            !wo.visit2InServiceAt ||
                            !!wo.visit2OutServiceAt
                          }
                          onChange={(e) => setKmOut2(e.target.value)}
                          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-zinc-200 disabled:opacity-50"
                        />
                      </label>
                      {wo.visit2OutServiceAt ? (
                        <p className="text-[10px] text-zinc-500">
                          Out: {new Date(wo.visit2OutServiceAt).toLocaleString("ro-RO")}
                        </p>
                      ) : canMarkServiceOut && wo.visit2InServiceAt ? (
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
              ) : (
                (() => {
                  const v = extraVisits.find((x) => x.n === selectedVisit);
                  if (!v) return null;
                  const km = extraKm[v.n] ?? { in: "", out: "" };
                  return (
                    <div className="mt-2 space-y-2 rounded-lg border border-sky-500/30 bg-sky-950/20 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/90">
                        {woT("visit.number").replace("{n}", String(v.n))}
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
                })()
              )}
            </div>
          </div>
        </div>
      </div>

      {wo.awaitingPostApproval || wo.postApprovalPath ? (
        <div className="border-b border-zinc-800 bg-zinc-950/60 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {woT("postApproval.title")}
          </p>
          {wo.awaitingPostApproval && canWrite ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void applyPostApproval("immediate")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {woT("postApproval.continueRepair")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void applyPostApproval("reschedule")}
                className="rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/50 disabled:opacity-50"
              >
                {woT("postApproval.reschedule")}
              </button>
              <span className="text-[10px] text-zinc-500">{woT("postApproval.actorHint")}</span>
            </div>
          ) : wo.postApprovalPath === "immediate" ? (
            <p className="mt-1 text-xs text-emerald-200">
              {wo.repairPathNote ?? woT("postApproval.immediateNote")}
            </p>
          ) : wo.postApprovalPath === "reschedule" ? (
            <div className="mt-1 space-y-2">
              <p className="text-xs text-amber-100">
                {wo.repairPathNote ?? woT("postApproval.rescheduleNote")}
              </p>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-zinc-200">
                {wo.linkedAppointmentScheduledAt ? (
                  <>
                    <p>
                      {woT("postApproval.appointmentProposal")}:{" "}
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
                        ? woT("postApproval.waitingSupplier")
                        : wo.linkedAppointmentStatus === "scheduled"
                          ? woT("postApproval.waitingManager")
                          : woT("postApproval.openSchedulerHint")}
                    </p>
                  </>
                ) : (
                  <p className="text-amber-100/90">
                    {woT("postApproval.noAppointment")}
                  </p>
                )}
                <p className="mt-2">
                  <Link
                    href={schedulerLink}
                    className="font-medium text-sky-300 hover:underline"
                  >
                    {wo.linkedAppointmentId
                      ? woT("postApproval.openAppointment")
                      : woT("postApproval.requestAppointment")}
                  </Link>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleOpen((v) => !v)}
                className="text-xs text-zinc-500 hover:text-zinc-300 hover:underline"
              >
                {rescheduleOpen ? woT("postApproval.hideDetails") : woT("postApproval.rescheduleDetails")}
              </button>
              {rescheduleOpen ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
                  <p>
                    {woT("postApproval.partnerValidationHint")}
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
                laborRateMechanicalCents: wo.supplier.laborRateMechanicalCents ?? null,
                laborRateBodyCents: wo.supplier.laborRateBodyCents ?? null,
                laborRatePaintCents: wo.supplier.laborRatePaintCents ?? null,
                laborRateDiagnosticCents: wo.supplier.laborRateDiagnosticCents ?? null,
                partsPriceBasis: wo.supplier.partsPriceBasis === "net" ? "net" : "list",
              }
            : null
        }
        supplierMenuItems={wo.supplier?.menuItems ?? []}
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
