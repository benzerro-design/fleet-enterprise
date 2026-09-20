import { FLEET_DISPLAY_TIMEZONE } from "@/lib/datetime-local";
import type { TicketEventRecord } from "@/lib/tickets-api";

export type ProposalHistoryActor = "manager" | "driver" | "supplier" | "admin" | "unknown";

export type ProposalHistoryEntry = {
  id: string;
  at: string;
  actor: ProposalHistoryActor;
  actorLabel: string;
  scheduledAt: string | null;
  note: string | null;
  summary: string;
  appointmentId: string | null;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO", {
    timeZone: FLEET_DISPLAY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function proposalHistoryActorLabel(actor: ProposalHistoryActor): string {
  switch (actor) {
    case "driver":
      return "Șofer";
    case "manager":
      return "Manager";
    case "supplier":
      return "Furnizor";
    case "admin":
      return "Admin L*";
    default:
      return "Propunere";
  }
}

function parseActorFromPayloadAndBody(
  payload: Record<string, unknown>,
  body: string | null,
): ProposalHistoryActor {
  const by = payload.proposalBy;
  if (by === "manager" || by === "driver" || by === "supplier" || by === "admin") return by;

  const text = body ?? "";
  if (/Șoferul/i.test(text)) return "driver";
  if (/Managerul/i.test(text)) return "manager";
  if (/Furnizorul/i.test(text)) return "supplier";
  if (/Adminul L\*/i.test(text) || /Adminul/i.test(text)) return "admin";
  return "unknown";
}

function isProposalHistoryEvent(ev: TicketEventRecord): boolean {
  if (ev.kind !== "workflow_advance") return false;
  const payload =
    ev.payload && typeof ev.payload === "object" ? (ev.payload as Record<string, unknown>) : {};
  if (payload.reproposed === true) return true;
  if (payload.slotChanged === true) return true;
  if (typeof payload.proposalBy === "string" && payload.proposalBy) return true;
  const body = ev.body ?? "";
  return /a repropus programarea|a propus altă dată|a propus altă oră/i.test(body);
}

export function ticketEventToProposalHistoryEntry(ev: TicketEventRecord): ProposalHistoryEntry | null {
  if (!isProposalHistoryEvent(ev)) return null;
  const payload =
    ev.payload && typeof ev.payload === "object" ? (ev.payload as Record<string, unknown>) : {};
  const appointmentId =
    typeof payload.appointmentId === "string" ? payload.appointmentId : null;
  const scheduledAt = typeof payload.scheduledAt === "string" ? payload.scheduledAt : null;
  const note =
    typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : null;
  const actor = parseActorFromPayloadAndBody(payload, ev.body);
  const summary =
    (ev.body ?? "").trim() || `${proposalHistoryActorLabel(actor)} — propunere slot`;

  return {
    id: ev.id,
    at: ev.createdAt,
    actor,
    actorLabel: proposalHistoryActorLabel(actor),
    scheduledAt,
    note,
    summary,
    appointmentId,
  };
}

/** Istoric propuneri slot din event-urile tichetului (cele mai recente primele). */
export function extractAppointmentProposalHistory(
  events: TicketEventRecord[],
  opts?: { appointmentId?: string | null },
): ProposalHistoryEntry[] {
  const filterAppt = opts?.appointmentId ?? null;
  const out: ProposalHistoryEntry[] = [];

  for (const ev of events) {
    const entry = ticketEventToProposalHistoryEntry(ev);
    if (!entry) continue;
    if (filterAppt && entry.appointmentId && entry.appointmentId !== filterAppt) continue;
    out.push(entry);
  }

  out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return out;
}

export function formatProposalHistoryWhen(iso: string | null | undefined): string {
  return formatWhen(iso);
}
