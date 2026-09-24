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

function IconView({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 7h15M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7m2 0v11.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
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

  type Tile = {
    key: string;
    id: string | null;
    url: string;
    name: string;
    mimeType?: string | null;
    canDelete: boolean;
  };

  const tiles: Tile[] = [
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

      {tiles.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">Niciun fișier pe acest tichet.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tiles.map((tile) => {
            const image = isImage(tile.mimeType, tile.name);
            return (
              <li
                key={tile.key}
                className="group relative h-10 w-10 overflow-hidden rounded-md border border-zinc-700 bg-zinc-950"
                title={tile.name}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tile.url} alt={tile.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[8px] font-semibold tracking-wide text-zinc-400">
                    PDF
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-zinc-950/80 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  <a
                    href={tile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-3.5 w-3.5 items-center justify-center text-zinc-100 hover:text-sky-300"
                    aria-label={`Vezi ${tile.name}`}
                  >
                    <IconView className="h-3 w-3" />
                  </a>
                  {tile.canDelete && tile.id ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void remove(tile.id!)}
                      className="flex h-3.5 w-3.5 items-center justify-center text-zinc-100 hover:text-rose-300 disabled:opacity-50"
                      aria-label={`Șterge ${tile.name}`}
                    >
                      <IconTrash className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
