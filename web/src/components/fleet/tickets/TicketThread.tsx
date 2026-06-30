"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FleetAvatar } from "@/components/fleet/tickets/TicketListGlyphs";
import { TicketAttachmentList } from "@/components/fleet/tickets/TicketAttachmentList";
import { TicketReactionBar } from "@/components/fleet/tickets/TicketReactionBar";
import {
  fleetJsonHeaders,
  ticketCommentText,
  ticketEventAttachments,
  ticketEventForwardMeta,
  ticketRoutingLabel,
  ticketsBrowserBase,
  type TicketEventRecord,
} from "@/lib/tickets-api";

function actorLabel(ev: TicketEventRecord): string {
  if (ev.actorDisplayName) {
    const level =
      ev.actorRoutingLevel === "L_STAR"
        ? "L★"
        : ev.actorRoutingLevel
          ? ticketRoutingLabel(ev.actorRoutingLevel)
          : "";
    return level ? `${ev.actorDisplayName} (${level})` : ev.actorDisplayName;
  }
  return ev.actorEmail ?? "Sistem";
}

type Props = {
  events: TicketEventRecord[];
  ticketId: string;
  canWrite: boolean;
  currentUserId?: string;
};

export function TicketThread({ events, ticketId, canWrite, currentUserId }: Props) {
  const comments = events.filter((e) => e.kind === "comment");
  const byId = new Map(events.map((e) => [e.id, e]));

  if (comments.length === 0) {
    return <p className="text-sm text-zinc-500">Niciun mesaj în conversație.</p>;
  }

  return (
    <ul className="space-y-4">
      {comments.map((ev) => (
        <TicketThreadItem
          key={ev.id}
          ev={ev}
          ticketId={ticketId}
          canWrite={canWrite}
          currentUserId={currentUserId}
          parent={ev.parentEventId ? byId.get(ev.parentEventId) : undefined}
        />
      ))}
    </ul>
  );
}

function TicketThreadItem({
  ev,
  ticketId,
  canWrite,
  currentUserId,
  parent,
}: {
  ev: TicketEventRecord;
  ticketId: string;
  canWrite: boolean;
  currentUserId?: string;
  parent?: TicketEventRecord;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ticketCommentText(ev) ?? "");
  const [pending, setPending] = useState(false);

  const name = actorLabel(ev);
  const text = ticketCommentText(ev);
  const attachments = ticketEventAttachments(ev);
  const forward = ticketEventForwardMeta(ev);
  const parentPreview = parent ? ticketCommentText(parent) : null;
  const canEdit =
    canWrite &&
    ev.actorUserId === currentUserId &&
    Date.now() - new Date(ev.createdAt).getTime() < 15 * 60 * 1000;

  async function saveEdit() {
    setPending(true);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticketId}/events/${ev.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={`flex gap-3 ${ev.parentEventId ? "ml-6 border-l-2 border-sky-900/40 pl-3" : ""}`}>
      <FleetAvatar name={name} size={32} />
      <div className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-300">{name}</span>
          <span>{new Date(ev.createdAt).toLocaleString("ro-RO")}</span>
          {ev.editedAt ? <span className="text-zinc-600">(editat)</span> : null}
          {forward ? (
            <Link
              href={`/fleet/tickets/${forward.ticketId}`}
              className="text-violet-400 hover:underline"
            >
              fwd #{forward.displayId}
            </Link>
          ) : null}
        </div>
        {parentPreview ? (
          <p className="mt-1 border-l-2 border-sky-800/60 pl-2 text-xs text-zinc-500">
            Răspuns la: {parentPreview.slice(0, 120)}
            {parentPreview.length > 120 ? "…" : ""}
          </p>
        ) : null}
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !draft.trim()}
                onClick={() => void saveEdit()}
                className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                Salvează
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
              >
                Anulează
              </button>
            </div>
          </div>
        ) : (
          <>
            {text ? <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-200">{text}</p> : null}
            <TicketAttachmentList attachments={attachments} />
            <TicketReactionBar
              ticketId={ticketId}
              event={ev}
              canWrite={canWrite}
              currentUserId={currentUserId}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {canWrite ? (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("ticket-reply", {
                        detail: {
                          eventId: ev.id,
                          preview: (text ?? "mesaj").slice(0, 80),
                        },
                      }),
                    )
                  }
                  className="text-[10px] text-zinc-500 hover:text-sky-300"
                >
                  Răspunde
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[10px] text-zinc-500 hover:text-sky-300"
                >
                  Editează
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </li>
  );
}
