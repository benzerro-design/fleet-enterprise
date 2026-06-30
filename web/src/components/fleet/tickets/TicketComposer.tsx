"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadTicketAttachment } from "@/lib/ticket-attachment-upload";
import { fleetJsonHeaders, ticketsBrowserBase, type TicketCommentAttachment } from "@/lib/tickets-api";

type Props = {
  ticketId: string;
  canWrite: boolean;
  closed: boolean;
};

export function TicketComposer({ ticketId, canWrite, closed }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<TicketCommentAttachment[]>([]);

  if (!canWrite || closed) return null;

  async function submit() {
    const text = body.trim();
    if (!text && staged.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${ticketsBrowserBase}/${ticketId}/comments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          body: text || undefined,
          attachments: staged.length > 0 ? staged : undefined,
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
        const row = await uploadTicketAttachment(file, ticketId);
        uploaded.push({ url: row.url, name: row.name, mimeType: row.mimeType });
      }
      setStaged((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
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
