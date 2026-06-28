"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TicketDetailPayload } from "@/lib/tickets-api";
import { fleetJsonHeaders, ticketsBrowserBase } from "@/lib/tickets-api";

type Props = {
  detail: TicketDetailPayload;
  canWrite: boolean;
};

export function TicketActionsPanel({ detail, canWrite }: Props) {
  const router = useRouter();
  const { ticket } = detail;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [routeReason, setRouteReason] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [showRoute, setShowRoute] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const closed = ticket.status === "resolved" || ticket.status === "cancelled";

  async function post(path: string, body?: unknown) {
    setPending(path);
    setError(null);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticket.id}${path}`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: body ? JSON.stringify(body) : undefined,
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
      router.refresh();
      setShowRoute(false);
      setShowReturn(false);
      setRouteReason("");
      setReturnReason("");
      setComment("");
    } finally {
      setPending(null);
    }
  }

  if (!canWrite) return null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-medium text-zinc-200">Acțiuni</h2>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!closed ? (
          <>
            <button
              type="button"
              disabled={!!pending}
              onClick={() => post("/resolve", { comment: comment.trim() || null, closeReminder: true })}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Tratează (rezolvă)
            </button>
            <button
              type="button"
              disabled={!!pending || !ticket.vehicleId}
              onClick={() => post("/transform", { entityType: "maintenance" })}
              className="rounded-lg border border-violet-700/60 bg-violet-950/40 px-3 py-1.5 text-sm text-violet-100 hover:bg-violet-950/60 disabled:opacity-50"
            >
              Transformă → mentenanță
            </button>
            {ticket.routingLevel !== "L_STAR" ? (
              <button
                type="button"
                disabled={!!pending}
                onClick={() => setShowRoute((v) => !v)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
              >
                Direcționează L★
              </button>
            ) : (
              <button
                type="button"
                disabled={!!pending}
                onClick={() => setShowReturn((v) => !v)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
              >
                Returnează L1
              </button>
            )}
          </>
        ) : null}
      </div>

      {!closed ? (
        <div className="mt-4">
          <label className="text-xs text-zinc-500">Comentariu (opțional la rezolvare)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Notă rezolvare…"
          />
          <button
            type="button"
            disabled={!!pending || !comment.trim()}
            onClick={() => post("/comments", { body: comment.trim() })}
            className="mt-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            Adaugă comentariu
          </button>
        </div>
      ) : null}

      {showRoute ? (
        <div className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
          <label className="text-xs text-amber-200">Motiv escaladare L★ (obligatoriu)</label>
          <textarea
            value={routeReason}
            onChange={(e) => setRouteReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!!pending || routeReason.trim().length < 3}
            onClick={() => post("/route", { targetLevel: "L_STAR", reason: routeReason.trim() })}
            className="mt-2 rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Confirmă escaladare
          </button>
        </div>
      ) : null}

      {showReturn ? (
        <div className="mt-4 rounded-lg border border-sky-900/40 bg-sky-950/20 p-3">
          <label className="text-xs text-sky-200">Motiv returnare L1 (obligatoriu)</label>
          <textarea
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!!pending || returnReason.trim().length < 3}
            onClick={() => post("/return", { reason: returnReason.trim() })}
            className="mt-2 rounded-lg bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
          >
            Confirmă returnare
          </button>
        </div>
      ) : null}

      {detail.links.length > 0 ? (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <h3 className="text-xs font-medium uppercase text-zinc-500">Legături</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {detail.links.map((link) => {
              const href =
                link.entityType === "maintenance"
                  ? `/fleet/maintenance/${link.entityId}`
                  : null;
              return (
                <li key={link.id}>
                  {href ? (
                    <Link href={href} className="text-emerald-400 hover:underline">
                      {link.entityType}: {link.entityId.slice(-8)}
                    </Link>
                  ) : (
                    <span className="text-zinc-400">
                      {link.entityType}: {link.entityId.slice(-8)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
