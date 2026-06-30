"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TicketActionGlyph } from "@/components/fleet/tickets/TicketListGlyphs";
import type { TicketRecord } from "@/lib/tickets-api";
import { fleetJsonHeaders, ticketsBrowserBase } from "@/lib/tickets-api";

type Props = {
  ticket: TicketRecord;
  canWrite: boolean;
  compact?: boolean;
};

function IconBtn({
  title,
  action,
  onClick,
  disabled,
  href,
}: {
  title: string;
  action: "claim" | "open" | "route" | "transform" | "resolve";
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
}) {
  const cls =
    "inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-700/80 bg-zinc-900/60 hover:bg-zinc-800 disabled:opacity-40";
  const inner = <TicketActionGlyph action={action} />;
  if (href) {
    return (
      <Link href={href} title={title} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" title={title} className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

export function TicketRowActions({ ticket, canWrite, compact }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const closed = ticket.status === "resolved" || ticket.status === "cancelled";
  const needsClaim = !ticket.ownerUserId && !closed;

  async function post(path: string, body?: unknown) {
    setPending(true);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticket.id}${path}`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`flex items-center gap-0.5 ${compact ? "" : "justify-end"}`}>
      <IconBtn title="Deschide" action="open" href={`/fleet/tickets/${ticket.id}`} />
      {canWrite && !closed ? (
        <>
          {needsClaim ? (
            <IconBtn title="Preluare" action="claim" disabled={pending} onClick={() => post("/claim")} />
          ) : null}
          {ticket.routingLevel !== "L_STAR" ? (
            <IconBtn
              title="Rutare L★"
              action="route"
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Motiv escaladare L★ (min. 3 caractere):");
                if (reason && reason.trim().length >= 3) {
                  void post("/route", { targetLevel: "L_STAR", reason: reason.trim() });
                }
              }}
            />
          ) : null}
          {ticket.vehicleId ? (
            <IconBtn
              title="Transformă → cost"
              action="transform"
              disabled={pending}
              onClick={() => post("/transform", { entityType: "cost", category: "alte", amountCents: 0 })}
            />
          ) : null}
          <IconBtn
            title="Rezolvă"
            action="resolve"
            disabled={pending}
            onClick={() => {
              const comment = window.prompt("Comentariu rezolvare (opțional):") ?? "";
              void post("/resolve", { comment: comment.trim(), closeReminder: true });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
