"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fleetJsonHeaders, ticketsBrowserBase } from "@/lib/tickets-api";

type Props = {
  ticketId: string;
  canWrite: boolean;
  closed: boolean;
};

export function TicketComposer({ ticketId, canWrite, closed }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite || closed) return null;

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticketId}/comments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ body: text }),
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
      setBody("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Mesaj nou</label>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        placeholder="Scrie un comentariu…"
      />
      <button
        type="button"
        disabled={pending || !body.trim()}
        onClick={() => void submit()}
        className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "Se trimite…" : "Trimite"}
      </button>
    </div>
  );
}
