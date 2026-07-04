import type { ServiceCaseRecord } from "@/lib/service-cases-api";

export type StoryChapterState = "done" | "now" | "next" | "later";

export type OperationalChapter = {
  id: string;
  title: string;
  situation: string;
  detail?: string;
  state: StoryChapterState;
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" });
}

export function operationalHeadline(
  serviceCase: ServiceCaseRecord | null | undefined,
  closed: boolean,
): string {
  if (closed) return "Tichet închis.";
  if (!serviceCase) return "Fluxul de service nu a pornit — poți porni dosarul sau rezolva direct din acțiuni.";
  if (serviceCase.status === "completed") return "Reparația s-a încheiat — dosarul e închis.";

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
  return "Dosar service activ — vezi pașii de mai jos.";
}

export function buildOperationalChapters(
  serviceCase: ServiceCaseRecord | null,
  closed: boolean,
): OperationalChapter[] {
  if (!serviceCase) {
    return [
      {
        id: "start",
        title: "Pornire",
        situation: closed ? "Tichet închis fără dosar service." : "Poți deschide dosarul sau rezolva din acțiuni rapide.",
        state: closed ? "done" : "now",
      },
    ];
  }

  const wo = serviceCase.workOrders[0];
  const appt = serviceCase.appointments.filter((a) => a.status !== "cancelled").at(-1);
  const stage = serviceCase.currentStage;
  const stageIdx = [
    "intake",
    "scheduled",
    "work_order",
    "in_service",
    "out_service",
    "quote",
    "approval",
    "invoiced",
    "cost",
    "closed",
  ].indexOf(stage);

  const chapters: Omit<OperationalChapter, "state">[] = [
    {
      id: "schedule",
      title: "Programare",
      situation: appt
        ? `${fmt(appt.scheduledAt)}${appt.supplierLegalName ? ` · ${appt.supplierLegalName}` : ""}`
        : "Nicio programare încă.",
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
      situation: wo?.approvedQuote
        ? `Aprobat · v${wo.approvedQuote.version} · ${(wo.approvedQuote.totalGrossCents / 100).toFixed(2)} ${wo.approvedQuote.currency}`
        : wo?.pendingQuote
          ? `De aprobat · v${wo.pendingQuote.version}`
          : wo?.inServiceAt || wo?.outServiceAt
            ? "Așteptăm devizul de la service."
            : "După constatare la service.",
    },
    {
      id: "decision",
      title: "Decizie reparație",
      situation: serviceCase.awaitingPostApproval
        ? "Alege: reparație acum sau reprogramare."
        : serviceCase.postApprovalPath === "reschedule"
          ? "Reprogramare — devizul rămâne valid."
          : serviceCase.postApprovalPath === "immediate"
            ? "Reparație continuată în service."
            : "După aprobarea devizului.",
    },
    {
      id: "billing",
      title: "Factură & cost",
      situation:
        stageIdx >= 8
          ? "Cost înregistrat."
          : stageIdx >= 7
            ? "Factură înregistrată — generează cost."
            : "După finalizarea reparației.",
    },
  ];

  if (serviceCase.status === "completed" || stage === "closed") {
    return chapters.map((c) => ({ ...c, state: "done" as const }));
  }

  const nowIndex = (() => {
    if (serviceCase.awaitingPostApproval) return 4;
    if (wo?.pendingQuote) return 3;
    if (stage === "invoiced" || stage === "cost") return 5;
    if (wo?.approvedQuote && (stage === "approval" || serviceCase.postApprovalPath)) return 4;
    if (stage === "quote" || stage === "approval") return 3;
    if (stage === "out_service" || (wo?.inServiceAt && wo.outServiceAt)) return 3;
    if (stage === "in_service" || wo?.inServiceAt) return 2;
    if (stage === "work_order" || wo) return 1;
    if (stage === "scheduled" || appt) return 0;
    return 0;
  })();

  return chapters.map((c, i) => ({
    ...c,
    state: (i < nowIndex ? "done" : i === nowIndex ? "now" : i === nowIndex + 1 ? "next" : "later") as StoryChapterState,
  }));
}
