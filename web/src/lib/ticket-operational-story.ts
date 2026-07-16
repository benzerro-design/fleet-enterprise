import type { ServiceCaseRecord } from "@/lib/service-cases-api";
import { formatDateRo } from "@/lib/datetime-local";
import {
  computeImmobilizationHours,
  formatMobilityBenefitSummary,
  isMobilityEligible,
  mobilityStatusLabel,
  MOBILITY_ELIGIBILITY_HOURS,
  type MobilityAssignmentRecord,
} from "@/lib/mobility-api";

export type StoryChapterState = "done" | "now" | "next" | "later";

export type OperationalChapterLink = {
  href: string;
  label: string;
};

export type OperationalChapter = {
  id: string;
  title: string;
  situation: string;
  detail?: string;
  links?: OperationalChapterLink[];
  state: StoryChapterState;
};

export type OperationalStoryInput = {
  serviceCase: ServiceCaseRecord | null;
  closed: boolean;
  ticketCreatedAt?: string;
  mobility?: MobilityAssignmentRecord | null;
  mobilityEligible?: boolean;
  mobilityImmobilizationHours?: number | null;
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" });
}

function fmtMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function operationalHeadline(
  serviceCase: ServiceCaseRecord | null | undefined,
  closed: boolean,
  ticketStatus?: string,
): string {
  if (closed) return "Tichet închis.";
  if (!serviceCase) {
    return "Fluxul de service nu a pornit — deschide fluxul service sau rezolvă direct din acțiuni.";
  }
  if (serviceCase.status === "completed" && ticketStatus !== "resolved" && ticketStatus !== "cancelled") {
    return "Dosarul service e închis — finalizează tichetul (rezolvă) sau verifică costul.";
  }
  if (serviceCase.status === "completed") return "Reparația s-a încheiat — tichet și dosar închise.";

  const wo = serviceCase.workOrders[0];
  const appt = serviceCase.appointments.find((a) => a.status !== "cancelled");
  const pendingAppt = serviceCase.appointments.find((a) => a.status === "scheduled");

  if (serviceCase.awaitingPostApproval) {
    return "Deviz aprobat — alege dacă continui reparația sau reprogramezi.";
  }
  if (wo?.pendingQuote) {
    return `Deviz trimis de service — așteaptă aprobarea ta${wo.supplierLegalName ? ` (${wo.supplierLegalName})` : ""}.`;
  }
  if (wo?.approvedQuote && serviceCase.postApprovalPath === "reschedule" && !wo.outServiceAt) {
    return "Deviz valid — reprogramează mașina la service, apoi factură.";
  }
  if (wo?.approvedQuote && serviceCase.currentStage === "invoiced") {
    return "Factura e înregistrată — generează costul și închide comanda.";
  }
  if (wo?.approvedQuote) return "Deviz aprobat — după reparație înregistrează factura.";
  if (wo && !wo.inServiceAt && appt?.managerConfirmedAt && appt?.driverAcknowledgedAt) {
    const nr = wo.displayNumber ? `${wo.displayNumber} · ` : "";
    return `Comanda ${nr}deschisă — marchează când mașina intră la service.`;
  }
  if (wo?.inServiceAt && !wo.outServiceAt) {
    return `Mașina e la service${wo.supplierLegalName ? ` (${wo.supplierLegalName})` : ""} — așteptăm devizul.`;
  }
  if (pendingAppt) {
    return `Programare ${fmt(pendingAppt.scheduledAt)}${pendingAppt.supplierLegalName ? ` la ${pendingAppt.supplierLegalName}` : ""} — confirmă.`;
  }
  if (appt?.managerConfirmedAt && !appt.driverAcknowledgedAt) {
    return "Managerul a confirmat — așteaptă Confirmă primire (șofer) ca să se deschidă comanda (WO).";
  }
  if (appt && !appt.managerConfirmedAt) {
    return "Programare stabilită — confirmă cu service-ul și șoferul.";
  }
  if (serviceCase.currentStage === "scheduled" || !appt) {
    return "Stabilește programarea la service (dată, furnizor).";
  }
  return "Dosar service activ — vezi fluxul operațional.";
}

export function buildOperationalChapters(input: OperationalStoryInput): OperationalChapter[] {
  const { serviceCase, closed, ticketCreatedAt, mobility, mobilityEligible, mobilityImmobilizationHours } = input;
  const wo = serviceCase?.workOrders[0];
  const approved = wo?.approvedQuote ?? null;
  const pendingQ = wo?.pendingQuote ?? null;
  const appt = serviceCase?.appointments.filter((a) => a.status !== "cancelled").at(-1);
  const stage = serviceCase?.currentStage;
  const caseClosed = serviceCase?.status === "completed" || stage === "closed";
  const woDone = wo?.status === "done" || !!wo?.completedAt;

  const quoteLinks: OperationalChapterLink[] = [];
  if (wo && approved) {
    quoteLinks.push({ href: `/fleet/work-orders/${wo.id}`, label: `Deviz v${approved.version}` });
    quoteLinks.push({
      href: `/api/work-orders/${wo.id}/quotes/${approved.id}/pdf`,
      label: "PDF",
    });
  } else if (wo && pendingQ) {
    quoteLinks.push({ href: `/fleet/work-orders/${wo.id}`, label: `Deviz v${pendingQ.version}` });
  }

  const billingLinks: OperationalChapterLink[] = [];
  const eligible =
    mobilityEligible ??
    (wo ? isMobilityEligible(wo.inServiceAt, wo.estimatedRepairAt, wo.outServiceAt) : false);
  const immHours =
    mobilityImmobilizationHours ??
    (wo ? computeImmobilizationHours(wo.inServiceAt, wo.estimatedRepairAt, wo.outServiceAt) : null);

  const mobilityLinks: OperationalChapterLink[] = [];
  if (mobility) {
    mobilityLinks.push({
      href: `/fleet/mobility/replacement-cars/${mobility.id}`,
      label: mobility.displayNumber ?? "Alocare",
    });
  }
  if (wo && wo.inServiceAt && !wo.outServiceAt && !mobility) {
    mobilityLinks.push({
      href: `/fleet/mobility/replacement-cars/new?wo=${wo.id}`,
      label: eligible ? "Alocă mașină schimb" : "Mobilitate (opțional)",
    });
  }

  if (approved?.invoiceNumber && wo) {
    billingLinks.push({
      href: approved.costEntryId
        ? `/fleet/costs/${approved.costEntryId}`
        : `/fleet/work-orders/${wo.id}`,
      label: `Factură ${approved.invoiceNumber}`,
    });
  }
  if (approved?.costEntryId) {
    billingLinks.push({ href: `/fleet/costs/${approved.costEntryId}`, label: "Cost înregistrat" });
  }

  const chapters: Omit<OperationalChapter, "state">[] = [
    {
      id: "ticket-open",
      title: "Tichet deschis",
      situation: ticketCreatedAt ? fmt(ticketCreatedAt) : "Solicitarea a fost înregistrată.",
      detail: closed ? "Tichet închis." : undefined,
    },
    {
      id: "schedule",
      title: "Programare",
      situation: appt
        ? `${fmt(appt.scheduledAt)}${appt.supplierLegalName ? ` · ${appt.supplierLegalName}` : ""}`
        : serviceCase
          ? "Nicio programare încă."
          : "După deschiderea fluxului service.",
      detail: appt?.status === "pending_supplier"
        ? "Propus de flotă — așteaptă validare furnizor."
        : appt?.managerConfirmedAt && !appt.driverAcknowledgedAt
          ? "Confirmată de manager — așteaptă Confirmă primire (șofer)."
          : appt?.managerConfirmedAt && appt.driverAcknowledgedAt
            ? "Confirmată de manager și șofer."
            : appt
              ? "De confirmat cu service și șofer."
              : undefined,
    },
    {
      id: "work-order",
      title: "Comandă service",
      situation: wo
        ? `${wo.displayNumber ? `${wo.displayNumber} · ` : ""}${wo.title}`
        : appt?.managerConfirmedAt && !appt.driverAcknowledgedAt
          ? "Se deschide după Confirmă primire (șofer)."
          : "Se deschide după confirmarea duală (manager + șofer).",
      detail: wo?.supplierLegalName ?? undefined,
      links: wo ? [{ href: `/fleet/work-orders/${wo.id}`, label: wo.displayNumber ?? "Comandă" }] : undefined,
    },
    {
      id: "at-service",
      title: "Mașina la service",
      situation: wo?.inServiceAt
        ? `Intrare ${fmt(wo.inServiceAt)}${wo.outServiceAt ? "" : " · încă în service"}`
        : wo
          ? "Marchează intrarea când mașina ajunge (partenerul o face la recepție)."
          : "După deschiderea comenzii — partenerul marchează intrarea/ieșirea.",
      detail: wo?.odometerKmIn != null ? `Km intrare: ${wo.odometerKmIn.toLocaleString("ro-RO")}` : undefined,
    },
    {
      id: "quote",
      title: "Deviz furnizor",
      situation: approved
        ? `Trimis · v${approved.version} · ${fmtMoney(approved.totalGrossCents, approved.currency)}`
        : pendingQ
          ? `De aprobat · v${pendingQ.version} · ${fmtMoney(pendingQ.totalGrossCents, pendingQ.currency)}`
          : wo?.inServiceAt || wo?.outServiceAt
            ? "Așteptăm devizul de la service."
            : "După constatare la service.",
      detail: wo?.estimatedRepairAt
        ? `Estimare finalizare reparație: ${formatDateRo(wo.estimatedRepairAt)}`
        : pendingQ || approved
          ? undefined
          : wo?.inServiceAt
            ? "Partenerul completează estimarea odată cu devizul."
            : undefined,
      links: quoteLinks.length ? quoteLinks : undefined,
    },
    {
      id: "approval",
      title: "Aprobare deviz",
      situation: approved
        ? `Aprobat · v${approved.version} · ${fmtMoney(approved.totalGrossCents, approved.currency)}`
        : pendingQ
          ? "Așteaptă decizia ta (aprobă sau respinge)."
          : "După primirea devizului de la furnizor.",
      detail: pendingQ
        ? wo?.estimatedRepairAt
          ? `Estimare finalizare: ${formatDateRo(wo.estimatedRepairAt)}`
          : "Lipsește estimarea partenerului — devizul nu poate fi trimis spre aprobare."
        : approved && wo?.estimatedRepairAt
          ? `Estimare finalizare: ${formatDateRo(wo.estimatedRepairAt)}`
          : undefined,
      links: approved && wo ? [{ href: `/fleet/work-orders/${wo.id}`, label: `Deviz v${approved.version}` }] : undefined,
    },
    {
      id: "decision",
      title: "Decizie reparație",
      situation: serviceCase?.awaitingPostApproval
        ? "Alege: reparație acum sau reprogramare."
        : serviceCase?.postApprovalPath === "reschedule"
          ? "Reprogramare — devizul rămâne valid."
          : serviceCase?.postApprovalPath === "immediate"
            ? "Reparație continuată în service."
            : approved
              ? "Decizie luată."
              : "După aprobarea devizului.",
    },
    {
      id: "mobility",
      title: "Mașină la schimb (opțional)",
      situation: mobility
        ? mobility.status === "waived"
          ? `Client a renunțat la mobilitate · ${formatMobilityBenefitSummary(mobility)}`
          : mobility.status === "returned" || mobility.status === "active" || mobility.status === "reserved"
            ? `Beneficiu mașină la schimb pe durata reparației · ${formatMobilityBenefitSummary(mobility)}`
            : `${mobilityStatusLabel(mobility.status)} · ${formatMobilityBenefitSummary(mobility)}`
        : !wo?.estimatedRepairAt && wo?.inServiceAt
          ? "Opțional — eligibilitatea se calculează după estimarea finalizării reparației (pe deviz)."
          : eligible && wo?.inServiceAt && !wo.outServiceAt
            ? `Eligibil mobilitate (${immHours?.toFixed(1) ?? "—"}h > ${MOBILITY_ELIGIBILITY_HOURS}h).`
            : wo?.inServiceAt && !wo.outServiceAt
              ? immHours != null
                ? `Sub prag ${MOBILITY_ELIGIBILITY_HOURS}h (${immHours.toFixed(1)}h) — poți înregistra renunțare sau alocare excepție.`
                : "Opțional — disponibil după estimare reparație."
              : "Opțional — dacă imobilizarea depășește 72h.",
      links: mobilityLinks.length ? mobilityLinks : undefined,
    },
    {
      id: "work-ready",
      title: "Lucrare gata",
      situation: wo?.readyAt
        ? `Reparație finalizată · ${fmt(wo.readyAt)}`
        : wo?.approvedQuote
          ? "Partenerul marchează când lucrarea e gata de predare."
          : "După aprobarea devizului și execuție.",
      detail: wo?.readyAt ? "Mașina reparată — urmează facturarea." : undefined,
    },
    {
      id: "billing",
      title: "Factură & cost",
      situation: approved?.costEntryId
        ? `Cost ${fmtMoney(approved.totalGrossCents, approved.currency)} înregistrat.`
        : approved?.invoicedAt
          ? `Factură ${approved.invoiceNumber ?? "—"} — generează cost${serviceCase?.workflowType === "itp" || serviceCase?.workflowType === "repair" ? " (opțional reminder)" : ""}.`
          : approved && wo?.readyAt
            ? "După lucrare gata: factură apoi cost."
            : approved
              ? "Marchează lucrare gata, apoi factură."
              : "După finalizarea reparației.",
      links: billingLinks.length ? billingLinks : undefined,
    },
    {
      id: "vehicle-out",
      title: "Mașina out service",
      situation: wo?.outServiceAt
        ? `Ieșire ${fmt(wo.outServiceAt)}${wo.odometerKmOut != null ? ` · ${wo.odometerKmOut.toLocaleString("ro-RO")} km` : ""}`
        : approved?.costEntryId
          ? "Partenerul marchează ieșirea la predarea mașinii (km ieșire)."
          : approved?.invoicedAt
            ? "Generează costul, apoi partenerul marchează ieșirea."
            : "După factură și cost — partenerul predă mașina și marchează ieșirea.",
      detail:
        wo?.inServiceAt && !wo.outServiceAt
          ? "Predare mașină reparată — partenerul înregistrează km ieșire pe comandă."
          : undefined,
      links: wo
        ? [{ href: `/fleet/work-orders/${wo.id}`, label: wo.displayNumber ?? "Comandă" }]
        : undefined,
    },
    {
      id: "closure",
      title: "Închidere lucrare",
      situation: caseClosed || woDone
        ? wo?.completedAt
          ? `Finalizat ${fmt(wo.completedAt)}`
          : "Comanda service închisă."
        : "După factură și cost — finalizează comanda.",
      detail: caseClosed ? "Dosar service complet." : undefined,
    },
  ];

  if (!serviceCase) {
    return chapters.map((c, i) => ({
      ...c,
      state: (closed
        ? "done"
        : i === 0
          ? "done"
          : i === 1
            ? "now"
            : "later") as StoryChapterState,
    }));
  }

  if (caseClosed) {
    return chapters.map((c) => ({ ...c, state: "done" as const }));
  }

  const nowIndex = (() => {
    if (caseClosed || woDone) return 11;
    if (wo?.outServiceAt && approved?.costEntryId) return 11;
    if (approved?.costEntryId && approved.invoicedAt) return 10;
    if (stage === "invoiced" || stage === "cost" || approved?.invoicedAt) return 9;
    if (wo?.readyAt) return 8;
    if (serviceCase!.awaitingPostApproval) return 6;
    if (serviceCase!.postApprovalPath && !wo?.readyAt) return 7;
    if (pendingQ) return 5;
    if (approved) return wo?.readyAt ? 9 : 7;
    if (stage === "quote" || stage === "approval") return 4;
    if (stage === "in_service" || wo?.inServiceAt) return 3;
    if (stage === "work_order" || wo) return 2;
    if (stage === "scheduled" || appt) return 1;
    return 1;
  })();

  return chapters.map((c, i) => ({
    ...c,
    state: (i < nowIndex ? "done" : i === nowIndex ? "now" : i === nowIndex + 1 ? "next" : "later") as StoryChapterState,
  }));
}
