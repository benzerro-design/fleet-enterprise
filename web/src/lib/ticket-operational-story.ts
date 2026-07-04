import type { ServiceCaseRecord } from "@/lib/service-cases-api";

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
  if (wo && !wo.inServiceAt && appt?.managerConfirmedAt) {
    const nr = wo.displayNumber ? `${wo.displayNumber} · ` : "";
    return `Comanda ${nr}deschisă — marchează când mașina intră la service.`;
  }
  if (wo?.inServiceAt && !wo.outServiceAt) {
    return `Mașina e la service${wo.supplierLegalName ? ` (${wo.supplierLegalName})` : ""} — așteptăm devizul.`;
  }
  if (pendingAppt) {
    return `Programare ${fmt(pendingAppt.scheduledAt)}${pendingAppt.supplierLegalName ? ` la ${pendingAppt.supplierLegalName}` : ""} — confirmă.`;
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
  const { serviceCase, closed, ticketCreatedAt } = input;
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
      detail: appt?.managerConfirmedAt
        ? "Confirmată de manager."
        : appt
          ? "De confirmat cu service și șofer."
          : undefined,
    },
    {
      id: "work-order",
      title: "Comandă service",
      situation: wo
        ? `${wo.displayNumber ? `${wo.displayNumber} · ` : ""}${wo.title}`
        : "Se deschide la confirmarea programării.",
      detail: wo?.supplierLegalName ?? undefined,
      links: wo ? [{ href: `/fleet/work-orders/${wo.id}`, label: wo.displayNumber ?? "Comandă" }] : undefined,
    },
    {
      id: "at-service",
      title: "Mașina la service",
      situation: wo?.inServiceAt
        ? `Intrare ${fmt(wo.inServiceAt)}${wo.outServiceAt ? ` · ieșire ${fmt(wo.outServiceAt)}` : " · încă în service"}`
        : wo
          ? "Marchează intrarea când mașina ajunge."
          : "După confirmarea programării.",
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
          ? `Factură ${approved.invoiceNumber ?? "—"} — generează cost.`
          : approved && wo?.readyAt
            ? "După lucrare gata: factură apoi cost."
            : approved
              ? "Marchează lucrare gata, apoi factură."
              : "După finalizarea reparației.",
      links: billingLinks.length ? billingLinks : undefined,
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
    if (caseClosed || woDone) return 9;
    if (approved?.costEntryId && approved.invoicedAt) return 9;
    if (stage === "invoiced" || stage === "cost" || approved?.invoicedAt) return 8;
    if (wo?.readyAt) return 7;
    if (serviceCase!.awaitingPostApproval) return 6;
    if (serviceCase!.postApprovalPath) return wo?.readyAt ? 7 : 6;
    if (pendingQ) return 5;
    if (approved) return wo?.readyAt ? 8 : 6;
    if (stage === "quote" || stage === "approval") return 4;
    if (stage === "out_service" || (wo?.inServiceAt && wo.outServiceAt)) return 4;
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
