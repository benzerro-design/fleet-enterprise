"use client";

import { useCallback, useEffect, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { workOrdersBrowserBase } from "@/lib/work-orders-api";

type Photo = {
  id: string;
  kind: "condition" | "defect";
  phase: "in" | "check" | "out" | "defect";
  url: string;
  caption: string | null;
};

type Props = {
  workOrderId: string;
  canWrite: boolean;
};

const PHASES = [
  { value: "in", label: "Recepție" },
  { value: "check", label: "Verificare" },
  { value: "out", label: "Predare" },
] as const;

export function WorkOrderPhotoSection({ workOrderId, canWrite }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [phase, setPhase] = useState<(typeof PHASES)[number]["value"]>("in");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/photos`, {
      headers: fleetJsonHeaders(),
    });
    if (!res.ok) return;
    const data = (await res.json()) as Photo[];
    setPhotos(Array.isArray(data) ? data : []);
  }, [workOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File, kind: "condition" | "defect") {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const uploaded = await fetch("/api/uploads/work-order-photos", { method: "POST", body: form });
    if (!uploaded.ok) {
      setError("Upload eșuat");
      return;
    }
    const saved = (await uploaded.json()) as { url?: string };
    if (!saved.url) return;
    const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/photos`, {
      method: "POST",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({
        kind,
        phase: kind === "defect" ? "defect" : phase,
        url: saved.url,
        caption: caption.trim() || null,
      }),
    });
    if (!res.ok) {
      setError("Nu am putut salva poza");
      return;
    }
    setCaption("");
    await load();
  }

  const condition = photos.filter((p) => p.kind === "condition");
  const defects = photos.filter((p) => p.kind === "defect");

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Fotografii comandă</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Starea mașinii la recepție, verificare și predare. Defectele găsite stau lângă deviz.
        </p>
      </div>
      <Gallery title="Verificare service" items={condition} />
      <Gallery title="Defecte" items={defects} />
      {canWrite ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-400">
            Moment
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as typeof phase)}
              className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              {PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[10rem] flex-1 text-xs text-zinc-400">
            Notă
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-100">
            Poză stare
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, "condition");
              }}
            />
          </label>
          <label className="rounded-lg bg-amber-800 px-3 py-2 text-xs text-amber-50">
            Poză defect
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, "defect");
              }}
            />
          </label>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}

function Gallery({ title, items }: { title: string; items: Photo[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-600">Nicio poză.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((p) => (
            <li key={p.id} className="w-28">
              <a href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? title} className="h-20 w-28 rounded-md object-cover" />
              </a>
              <p className="mt-1 text-[10px] text-zinc-500">
                {p.phase}
                {p.caption ? ` · ${p.caption}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
