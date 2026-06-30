"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { uploadTicketAttachment } from "@/lib/ticket-attachment-upload";
import { TICKET_REPLY_TEMPLATES } from "@/lib/ticket-messaging";
import {
  fleetJsonHeaders,
  ticketsBrowserBase,
  type TicketCommentAttachment,
  type TicketRecord,
} from "@/lib/tickets-api";

type ReplyTarget = { eventId: string; preview: string };

type Props = {
  ticket: TicketRecord;
  canWrite: boolean;
  closed: boolean;
};

export function TicketComposer({ ticket, canWrite, closed }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<TicketCommentAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [forwardFromId, setForwardFromId] = useState("");

  useEffect(() => {
    function onReply(e: Event) {
      const detail = (e as CustomEvent<ReplyTarget>).detail;
      if (detail?.eventId) setReplyTo(detail);
    }
    window.addEventListener("ticket-reply", onReply);
    return () => window.removeEventListener("ticket-reply", onReply);
  }, []);

  if (!canWrite || closed) return null;

  const mentionUserIds: string[] = [];
  if (ticket.ownerUserId && body.includes("@owner")) {
    mentionUserIds.push(ticket.ownerUserId);
  }

  async function submit() {
    const text = body.trim();
    if (!text && staged.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticket.id}/comments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          body: text || undefined,
          attachments: staged.length > 0 ? staged : undefined,
          parentEventId: replyTo?.eventId,
          forwardedFromTicketId: forwardFromId.trim() || undefined,
          mentions: mentionUserIds.length > 0 ? mentionUserIds : undefined,
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
      setBody("");
      setStaged([]);
      setReplyTo(null);
      setForwardFromId("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setPending(true);
    try {
      const uploaded: TicketCommentAttachment[] = [];
      for (const file of Array.from(files).slice(0, 8 - staged.length)) {
        const row = await uploadTicketAttachment(file, ticket.id);
        uploaded.push({ url: row.url, name: row.name, mimeType: row.mimeType });
      }
      setStaged((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function insertMentionOwner() {
    setBody((prev) => (prev.includes("@owner") ? prev : `${prev.trimEnd()} @owner `.trimStart()));
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Mesaj nou</label>
      {replyTo ? (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs text-sky-200">
          <p>
            <span className="text-sky-400">Răspuns la:</span> {replyTo.preview}
          </p>
          <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-400 hover:text-white">
            ×
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TICKET_REPLY_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setBody(t.text)}
            className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-900"
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        placeholder="Scrie un comentariu… (@owner pentru owner tichet)"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {ticket.ownerUserId ? (
          <button
            type="button"
            onClick={insertMentionOwner}
            className="rounded-lg border border-violet-800/50 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-950/30"
          >
            @owner
          </button>
        ) : null}
        <input
          value={forwardFromId}
          onChange={(e) => setForwardFromId(e.target.value)}
          placeholder="Forward din tichet (ID)"
          className="min-w-[160px] flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-400"
        />
      </div>
      {staged.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {staged.map((a) => (
            <li
              key={a.url}
              className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
            >
              <span className="max-w-[140px] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => setStaged((prev) => prev.filter((x) => x.url !== a.url))}
                className="text-zinc-500 hover:text-red-400"
                aria-label="Elimină"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void onFilesSelected(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFilesSelected(e.target.files)}
        />
        <button
          type="button"
          disabled={pending || staged.length >= 8}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
        >
          Atașează…
        </button>
        <button
          type="button"
          disabled={pending || staged.length >= 8}
          onClick={() => cameraRef.current?.click()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
        >
          Foto
        </button>
        <button
          type="button"
          disabled={pending || (!body.trim() && staged.length === 0)}
          onClick={() => void submit()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {pending ? "Se trimite…" : "Trimite"}
        </button>
      </div>
    </div>
  );
}
