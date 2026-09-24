"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

function isImage(mimeType?: string | null, name?: string): boolean {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name ?? "");
}

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

  type Row =
    | { key: string; id: string | null; url: string; name: string; mimeType?: string | null; canDelete: boolean };

  const rows: Row[] = [
    ...attachments.map((a) => ({
      key: a.id,
      id: a.id,
      url: a.url,
      name: a.fileName,
      mimeType: a.mimeType,
      canDelete: Boolean(canWrite && !closed),
    })),
    ...legacyOnly.map((a) => ({
      key: `legacy-${a.url}`,
      id: null,
      url: a.url,
      name: a.name,
      mimeType: a.mimeType,
      canDelete: false,
    })),
  ];

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

  return (
    <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Atașamente tichet
          </p>
          <p className="text-[11px] text-zinc-500">Vizibile pe tot tichetul, nu doar pe un mesaj.</p>
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

      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">Niciun fișier pe acest tichet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const image = isImage(row.mimeType, row.name);
            return (
              <li
                key={row.key}
                className="group flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5"
              >
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900"
                  title={row.name}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-medium text-zinc-400">
                      PDF
                    </span>
                  )}
                </a>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-xs text-zinc-200 hover:text-sky-300"
                >
                  {row.name}
                </a>
                {row.canDelete && row.id ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void remove(row.id!)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-800 hover:text-rose-300 disabled:opacity-50"
                    aria-label={`Șterge ${row.name}`}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
