"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TICKET_REACTION_EMOJIS } from "@/lib/ticket-messaging";
import { fleetJsonHeaders, ticketEventReactions, ticketsBrowserBase, type TicketEventRecord } from "@/lib/tickets-api";

type Props = {
  ticketId: string;
  event: TicketEventRecord;
  canWrite: boolean;
  currentUserId?: string;
};

export function TicketReactionBar({ ticketId, event, canWrite, currentUserId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const reactions = ticketEventReactions(event);

  if (!canWrite) {
    if (reactions.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {reactions.map((r) => (
          <span
            key={`${r.userId}-${r.emoji}`}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300"
            title={r.displayName}
          >
            {r.emoji}
          </span>
        ))}
      </div>
    );
  }

  async function toggle(emoji: string) {
    setPending(emoji);
    try {
      await fetch(`${ticketsBrowserBase}/${ticketId}/events/${event.id}/reactions`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ emoji }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {TICKET_REACTION_EMOJIS.map((emoji) => {
        const count = counts.get(emoji) ?? 0;
        const mine = reactions.some((r) => r.userId === currentUserId && r.emoji === emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={pending != null}
            onClick={() => void toggle(emoji)}
            className={`rounded-full border px-2 py-0.5 text-xs transition ${
              mine
                ? "border-sky-700 bg-sky-950/50 text-sky-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {emoji}
            {count > 0 ? <span className="ml-1 font-mono text-[10px]">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
