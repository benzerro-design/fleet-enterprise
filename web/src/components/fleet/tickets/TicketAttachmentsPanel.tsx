"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TicketAttachmentList } from "@/components/fleet/tickets/TicketAttachmentList";
import { uploadTicketAttachment } from "@/lib/ticket-attachment-upload";
import {
  fleetJsonHeaders,
  ticketsBrowserBase,
  type TicketAttachmentRecord,
  type TicketCommentAttachment,
} from "@/lib/tickets-api";

type Props = {
  ticketId: string;
  attachments: TicketAttachmentRecord[];
  /** Fallback din evenimente (comentarii vechi fără rând în CrmTicketAttachment). */
  legacyFromEvents?: TicketCommentAttachment[];
  canWrite: boolean;
  closed: boolean;
};

export function TicketAttachmentsPanel({
  ticketId,
  attachments,
  legacyFromEvents = [],
  canWrite,
  closed,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legacyOnly = legacyFromEvents.filter(
    (leg) => !attachments.some((a) => a.url === leg.url),
  );

  async function onFiles(files: FileList | null) {
    if (!files?.length || closed) return;
    setPending(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, 8)) {
        const up = await uploadTicketAttachment(file, ticketId);
        const res = await fetch(`${ticketsBrowserBase}/${ticketId}/attachments`, {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            url: up.url,
            fileName: up.name,
            mimeType: up.mimeType,
            sizeBytes: file.size,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? `HTTP ${res.status}`);
        }
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!canWrite || closed) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticketId}/attachments/${id}`, {
        method: "DELETE",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setPending(false);
    }
  }

  const asList: TicketCommentAttachment[] = [
    ...attachments.map((a) => ({
      url: a.url,
      name: a.fileName,
      mimeType: a.mimeType ?? undefined,
    })),
    ...legacyOnly,
  ];

  return (
    <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Atașamente tichet
          </p>
          <p className="text-[11px] text-zinc-500">
            PDF / imagini pe GCS — vizibile pe toată conversația, nu doar pe un mesaj.
          </p>
        </div>
        {canWrite && !closed ? (
          <label className="cursor-pointer rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800">
            {pending ? "Se încarcă…" : "+ Adaugă fișier"}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              disabled={pending}
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      {asList.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">Niciun fișier pe acest tichet.</p>
      ) : (
        <div className="mt-2">
          <TicketAttachmentList attachments={asList} />
          {canWrite && !closed && attachments.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span className="truncate">{a.fileName}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void remove(a.id)}
                    className="shrink-0 text-red-400/80 hover:text-red-300 disabled:opacity-50"
                  >
                    Șterge
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
