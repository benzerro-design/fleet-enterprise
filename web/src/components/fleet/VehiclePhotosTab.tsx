"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import { uploadDocumentFile } from "@/lib/document-upload";
import type { VehiclePhotoKind, VehiclePhotosPayload } from "@/lib/vehicle-profile-types";

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

const PHOTO_KINDS: { value: VehiclePhotoKind; label: string }[] = [
  { value: "exterior", label: "Exterior" },
  { value: "interior", label: "Interior" },
  { value: "damage", label: "Daună" },
  { value: "document", label: "Document" },
  { value: "other", label: "Altele" },
];

function defaultSessionLabel(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${ym} — inspecție lunară`;
}

function photoKindLabel(kind: VehiclePhotoKind | null): string | null {
  if (!kind) return null;
  return PHOTO_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

type Props = {
  vehicleId: string;
  write: boolean;
  initial: VehiclePhotosPayload;
};

export function VehiclePhotosTab({ vehicleId, write, initial }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initial.items);
  const [caption, setCaption] = useState("");
  const [sessionLabel, setSessionLabel] = useState(defaultSessionLabel);
  const [kind, setKind] = useState<VehiclePhotoKind | "">("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessions = useMemo(() => {
    const map = new Map<string, typeof photos>();
    for (const photo of photos) {
      const key = photo.sessionLabel?.trim() || "Fără sesiune";
      const list = map.get(key) ?? [];
      list.push(photo);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [photos]);

  const knownSessions = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) {
      const s = p.sessionLabel?.trim();
      if (s) set.add(s);
    }
    return [...set].sort();
  }, [photos]);

  async function onUpload(file: File) {
    if (!write) return;
    if (!file.type.startsWith("image/")) {
      setError("Doar imagini (JPEG, PNG, WebP) sunt acceptate.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const uploaded = await uploadDocumentFile(file, caption.trim() || null);
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/photos`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          fileUrl: uploaded.url,
          fileName: uploaded.name,
          caption: caption.trim() || null,
          sessionLabel: sessionLabel.trim() || null,
          kind: kind === "" ? null : kind,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {}
        setError(msg);
        return;
      }
      const photo = (await res.json()) as (typeof photos)[0];
      setPhotos((prev) => [...prev, photo]);
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Încărcare eșuată.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(photoId: string) {
    if (!write) return;
    if (!window.confirm("Ștergeți această fotografie?")) return;
    setDeletingId(photoId);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/photos/${photoId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        setError(`Ștergere eșuată (HTTP ${res.status}).`);
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Fotografii pe sesiuni datate (ex. inspecție lunară) — nu un album plat. Formate: JPEG, PNG, WebP (max 10 MB).
      </p>

      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p>
      ) : null}

      {write ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4 space-y-4">
          <h3 className="text-sm font-medium text-zinc-300">Încarcă fotografie</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm text-zinc-400">Sesiune</label>
              <input
                type="text"
                list="vehicle-photo-sessions"
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                disabled={pending}
                placeholder="ex. 2026-09 — inspecție lunară"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              />
              <datalist id="vehicle-photo-sessions">
                {knownSessions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm text-zinc-400">Tip</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as VehiclePhotoKind | "")}
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">—</option>
                {PHOTO_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400">Descriere (opțional)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={pending}
                placeholder="ex. Față stânga, interior, daună bară"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-zinc-400">Fișier imagine</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
                className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-950 hover:file:bg-emerald-400"
              />
            </div>
          </div>
          {pending ? <p className="text-xs text-zinc-500">Se încarcă…</p> : null}
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 px-4 py-8 text-center text-sm text-zinc-500">
          Nici o fotografie încărcată.
        </p>
      ) : (
        <div className="space-y-8">
          {sessions.map(([label, items]) => (
            <section key={label} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-medium text-zinc-200">{label}</h3>
                <span className="text-xs text-zinc-500">{items.length} foto</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    write={write}
                    deleting={deletingId === photo.id}
                    onDelete={() => void onDelete(photo.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  write,
  deleting,
  onDelete,
}: {
  photo: VehiclePhotosPayload["items"][0];
  write: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isImage = IMAGE_EXT.test(photo.fileUrl) || photo.fileUrl.includes("/uploads/");
  const kindLabel = photoKindLabel(photo.kind);

  return (
    <article className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
      <div className="relative aspect-[4/3] bg-zinc-900">
        {!imgError && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.fileUrl}
            alt={photo.caption ?? photo.fileName ?? "Fotografie vehicul"}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">Previzualizare indisponibilă</div>
        )}
      </div>
      <div className="space-y-1 p-3">
        {kindLabel ? <p className="text-xs uppercase tracking-wide text-zinc-500">{kindLabel}</p> : null}
        {photo.caption ? <p className="text-sm text-zinc-200">{photo.caption}</p> : null}
        <p className="truncate text-xs text-zinc-500">{photo.fileName ?? photo.fileUrl}</p>
        <p className="text-xs text-zinc-600">
          {new Date(photo.createdAt).toLocaleString("ro-RO")}
          {photo.uploadedByEmail ? ` · ${photo.uploadedByEmail}` : ""}
        </p>
        <div className="flex gap-2 pt-1">
          <a
            href={photo.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            Deschide
          </a>
          {write ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
            >
              {deleting ? "Șterg…" : "Șterge"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
