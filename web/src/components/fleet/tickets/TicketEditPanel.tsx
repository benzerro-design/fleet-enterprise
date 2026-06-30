"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  fleetJsonHeaders,
  TICKET_TYPES,
  ticketsBrowserBase,
  type TicketPriority,
  type TicketRecord,
  type TicketStatus,
  type TicketType,
} from "@/lib/tickets-api";

type Props = {
  ticket: TicketRecord;
  canPatch: boolean;
};

export function TicketEditPanel({ ticket, canPatch }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(ticket.subject);
  const [description, setDescription] = useState(ticket.description ?? "");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [ticketType, setTicketType] = useState<TicketType>(ticket.ticketType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canPatch) return null;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticket.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim() || null,
          priority,
          status,
          ticketType,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-200">Editare tichet</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
        >
          {open ? "Închide" : "Editează"}
        </button>
      </div>
      {open ? (
        <div className="mt-4 space-y-3">
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div>
            <label className="text-xs text-zinc-500">Subiect</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Descriere</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-zinc-500">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
              >
                <option value="open">Deschis</option>
                <option value="in_progress">În lucru</option>
                <option value="resolved">Rezolvat</option>
                <option value="cancelled">Anulat</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Prioritate</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
              >
                <option value="low">Scăzută</option>
                <option value="normal">Normală</option>
                <option value="high">Ridicată</option>
                <option value="urgent">Urgentă</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Tip</label>
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as TicketType)}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
              >
                {TICKET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            disabled={pending || !subject.trim()}
            onClick={() => void save()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "Se salvează…" : "Salvează modificările"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
