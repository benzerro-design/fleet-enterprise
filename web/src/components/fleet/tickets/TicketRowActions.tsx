"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TicketActionGlyph } from "@/components/fleet/tickets/TicketListGlyphs";
import type { TicketRecord } from "@/lib/tickets-api";
import { fleetJsonHeaders, ticketsBrowserBase } from "@/lib/tickets-api";

type Props = {
  ticket: TicketRecord;
  /** Transform cursă — L0 + L1. */
  canWrite: boolean;
  /** Claim / route / resolve — doar L1 / L*. */
  canManage?: boolean;
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

export function TicketRowActions({ ticket, canWrite, canManage = false, compact }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const closed = ticket.status === "resolved" || ticket.status === "cancelled";
  const needsClaim = canManage && !ticket.ownerUserId && !closed;
  const canTransform = canWrite && !!ticket.vehicleId && !closed;

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
      {!closed ? (
        <>
          {needsClaim ? (
            <IconBtn title="Preluare" action="claim" disabled={pending} onClick={() => post("/claim")} />
          ) : null}
          {canManage && ticket.routingLevel !== "L_STAR" ? (
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
          {canTransform ? (
            <IconBtn
              title={canManage ? "Transformă → cost" : "Transformă → cursă"}
              action="transform"
              disabled={pending}
              onClick={() =>
                canManage
                  ? post("/transform", { entityType: "cost", category: "alte", amountCents: 0 })
                  : post("/transform", { entityType: "trip" })
              }
            />
          ) : null}
          {canManage ? (
            <IconBtn
              title="Rezolvă"
              action="resolve"
              disabled={pending}
              onClick={() => {
                const comment = window.prompt("Comentariu rezolvare (opțional):") ?? "";
                void post("/resolve", { comment: comment.trim(), closeReminder: true });
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
