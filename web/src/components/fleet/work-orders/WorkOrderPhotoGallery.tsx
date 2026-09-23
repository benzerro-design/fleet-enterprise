"use client";

import { useCallback, useEffect, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { workOrdersBrowserBase } from "@/lib/work-orders-api";

export type WorkOrderPhoto = {
  id: string;
  visitIndex: number;
  kind: "condition" | "defect";
  phase: "in" | "check" | "out" | "defect";
  url: string;
  caption: string | null;
  quoteId: string | null;
};

type GalleryProps = {
  workOrderId: string;
  canWrite: boolean;
  /** Reception: visit + phase in|out. Defect: quoteId + kind defect. */
  mode: "visit" | "quote";
  visitIndex?: number;
  phase?: "in" | "out";
  quoteId?: string | null;
  title?: string;
};

export function WorkOrderPhotoGallery({
  workOrderId,
  canWrite,
  mode,
  visitIndex = 1,
  phase = "in",
  quoteId = null,
  title,
}: GalleryProps) {
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lightbox, setLightbox] = useState<WorkOrderPhoto | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (mode === "visit") {
      q.set("kind", "condition");
      q.set("visitIndex", String(visitIndex));
      q.set("phase", phase);
    } else {
      q.set("kind", "defect");
      if (quoteId) q.set("quoteId", quoteId);
    }
    const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/photos?${q}`, {
      headers: fleetJsonHeaders(),
    });
    if (!res.ok) return;
    const data = (await res.json()) as WorkOrderPhoto[];
    setPhotos(Array.isArray(data) ? data : []);
  }, [workOrderId, mode, visitIndex, phase, quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setError(null);
    setPending(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const uploaded = await fetch("/api/uploads/work-order-photos", { method: "POST", body: form });
      if (!uploaded.ok) {
        setError("Upload eșuat");
        return;
      }
      const saved = (await uploaded.json()) as { url?: string };
      if (!saved.url) return;
      const body =
        mode === "visit"
          ? {
              kind: "condition",
              phase,
              visitIndex,
              url: saved.url,
              caption: null,
            }
          : {
              kind: "defect",
              phase: "defect",
              visitIndex: 0,
              quoteId,
              url: saved.url,
              caption: caption.trim() || null,
            };
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/photos`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Nu am putut salva poza");
        return;
      }
      if (mode === "quote") setCaption("");
      await load();
    } finally {
      setPending(false);
    }
  }

  function downloadOne(p: WorkOrderPhoto) {
    const a = document.createElement("a");
    a.href = p.url;
    a.download = p.caption?.trim() || `poza-${p.id}`;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  async function downloadAll() {
    for (const p of photos) {
      downloadOne(p);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return (
    <div className="space-y-2">
      {title ? <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p> : null}
      {photos.length === 0 ? (
        <p className="text-[11px] text-zinc-500">Nicio poză.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {photos.map((p) => (
              <li key={p.id} className="group relative w-[4.5rem]">
                <button
                  type="button"
                  onClick={() => setLightbox(p)}
                  className="block w-full overflow-hidden rounded border border-zinc-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? "Poză"} className="h-14 w-full object-cover" />
                </button>
                <button
                  type="button"
                  title="Descarcă"
                  onClick={() => downloadOne(p)}
                  className="absolute right-0.5 top-0.5 hidden rounded bg-zinc-950/90 px-1 text-[10px] text-zinc-100 group-hover:block"
                >
                  ↓
                </button>
                {p.caption ? <p className="mt-0.5 truncate text-[9px] text-zinc-500">{p.caption}</p> : null}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void downloadAll()}
            className="text-[10px] text-sky-400 hover:underline"
          >
            Download all ({photos.length})
          </button>
        </>
      )}
      {canWrite ? (
        <div className="space-y-1.5 pt-1">
          {mode === "quote" ? (
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Notă defect (opțional)"
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-200"
            />
          ) : null}
          <label className="inline-flex cursor-pointer rounded bg-emerald-700 px-2 py-1 text-[11px] text-white hover:bg-emerald-600">
            {pending ? "Se încarcă…" : "Adaugă poză"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={pending || (mode === "quote" && !quoteId)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          {mode === "quote" && !quoteId ? (
            <p className="text-[10px] text-amber-400">Salvează / alege un deviz ca să atașezi poze.</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-[11px] text-rose-400">{error}</p> : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-h-[90vh] max-w-3xl space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? "Poză"}
              className="max-h-[80vh] max-w-full rounded object-contain"
            />
            <div className="flex flex-wrap gap-2">
              <a
                href={lightbox.url}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100"
              >
                Vizualizare
              </a>
              <button
                type="button"
                onClick={() => downloadOne(lightbox)}
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
