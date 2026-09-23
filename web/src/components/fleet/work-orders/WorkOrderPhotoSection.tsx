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

export function WorkOrderPhotoSection({ workOrderId, canWrite }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  async function upload(file: File, kind: "condition" | "defect", phase: Photo["phase"]) {
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
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/photos`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          kind,
          phase,
          url: saved.url,
          caption: kind === "defect" ? caption.trim() || null : null,
        }),
      });
      if (!res.ok) {
        setError("Nu am putut salva poza");
        return;
      }
      if (kind === "defect") setCaption("");
      await load();
    } finally {
      setPending(false);
    }
  }

  const incoming = photos.filter((p) => p.kind === "condition" && p.phase === "in");
  const outgoing = photos.filter((p) => p.kind === "condition" && p.phase === "out");
  const repair = photos.filter((p) => p.kind === "defect" || p.phase === "check");

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Recepție — intrare și ieșire din service</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Starea mașinii când intră și când pleacă. Nu țin loc de pozele de reparație.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PhotoColumn
            title="Intrare"
            items={incoming}
            canWrite={canWrite}
            pending={pending}
            button="Adaugă poză la intrare"
            onFile={(file) => void upload(file, "condition", "in")}
          />
          <PhotoColumn
            title="Ieșire"
            items={outgoing}
            canWrite={canWrite}
            pending={pending}
            button="Adaugă poză la ieșire"
            onFile={(file) => void upload(file, "condition", "out")}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Reparație — defect, atelier, deviz</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ce s-a găsit și ce se repară. Stau lângă deviz, ca să se vadă legătura dintre poză și lucrare.
        </p>
        <Gallery items={repair} empty="Nicio poză de reparație." />
        {canWrite ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1 text-xs text-zinc-500">
              Notă (defect sau lucrare)
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500">
              {pending ? "Se încarcă…" : "Adaugă poză de reparație"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={pending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file, "defect", "defect");
                }}
              />
            </label>
          </div>
        ) : null}
      </section>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

function PhotoColumn({
  title,
  items,
  canWrite,
  pending,
  button,
  onFile,
}: {
  title: string;
  items: Photo[];
  canWrite: boolean;
  pending: boolean;
  button: string;
  onFile: (file: File) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <Gallery items={items} empty={`Nicio poză de ${title.toLowerCase()}.`} />
      {canWrite ? (
        <label className="mt-2 inline-flex cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500">
          {pending ? "Se încarcă…" : button}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

function Gallery({ items, empty }: { items: Photo[]; empty: string }) {
  if (items.length === 0) {
    return <p className="mt-2 text-xs text-zinc-500">{empty}</p>;
  }
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((p) => (
        <li key={p.id} className="w-28">
          <a href={p.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? "Poză comandă"} className="h-20 w-28 rounded-md object-cover" />
          </a>
          {p.caption ? <p className="mt-1 text-[10px] text-zinc-500">{p.caption}</p> : null}
        </li>
      ))}
    </ul>
  );
}
