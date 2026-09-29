"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import { uploadDocumentFile } from "@/lib/document-upload";
import type { VehiclePhotoKind, VehiclePhotoRow, VehiclePhotosPayload } from "@/lib/vehicle-profile-types";

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
  const [sessionLabel, setSessionLabel] = useState(defaultSessionLabel);
  const [newSessionDraft, setNewSessionDraft] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);
  const [pending, setPending] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sessions = useMemo(() => {
    const map = new Map<string, VehiclePhotoRow[]>();
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

  async function uploadMany(files: FileList | File[]) {
    if (!write) return;
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setError("Selectează imagini (JPEG, PNG, WebP).");
      return;
    }
    setPending(true);
    setError(null);
    setInfo(null);
    const added: VehiclePhotoRow[] = [];
    try {
      for (const file of list) {
        const uploaded = await uploadDocumentFile(file, null);
        const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/photos`, {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            fileUrl: uploaded.url,
            fileName: uploaded.name,
            sessionLabel: sessionLabel.trim() || null,
            kind: null,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? `HTTP ${res.status} la ${file.name}`);
        }
        added.push((await res.json()) as VehiclePhotoRow);
      }
      setPhotos((prev) => [...prev, ...added]);
      setInfo(
        `${added.length} foto încărcate în „${sessionLabel.trim() || "Fără sesiune"}”. Setează tipul pe fiecare card.`,
      );
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Încărcare eșuată.");
      if (added.length) setPhotos((prev) => [...prev, ...added]);
    } finally {
      setPending(false);
    }
  }

  async function patchPhoto(
    photoId: string,
    body: { kind?: VehiclePhotoKind | null; isHero?: boolean; caption?: string | null },
  ) {
    if (!write) return;
    setPatchingId(photoId);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/photos/${photoId}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as VehiclePhotoRow;
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id === updated.id) return updated;
          if (body.isHero === true) return { ...p, isHero: false };
          return p;
        }),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Actualizare eșuată.");
    } finally {
      setPatchingId(null);
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

  function createNewSession() {
    const label = newSessionDraft.trim() || defaultSessionLabel();
    setSessionLabel(label);
    setNewSessionDraft("");
    setShowNewSession(false);
    setInfo(`Sesiune activă: „${label}”. Încarcă pozele acum.`);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Încarcă mai multe poze odată, apoi setează tipul pe fiecare. Marchează una ca icon/header pe fișa
        vehiculului. Formate: JPEG, PNG, WebP (max 10 MB).
      </p>

      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {info}
        </p>
      ) : null}

      {write ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4 space-y-4">
          <h3 className="text-sm font-medium text-zinc-300">Încarcă fotografii (bulk)</h3>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label className="block text-sm text-zinc-400">Sesiune activă</label>
              <select
                value={knownSessions.includes(sessionLabel) ? sessionLabel : "__custom__"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") {
                    setShowNewSession(true);
                    return;
                  }
                  if (v === "__custom__") return;
                  setSessionLabel(v);
                }}
                disabled={pending}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                {knownSessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {!knownSessions.includes(sessionLabel) ? (
                  <option value="__custom__">{sessionLabel}</option>
                ) : null}
                <option value="__new__">+ Sesiune nouă…</option>
              </select>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowNewSession(true)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
            >
              Sesiune nouă
            </button>
          </div>

          {showNewSession ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="min-w-[14rem] flex-1">
                <label className="block text-xs text-zinc-500">Nume sesiune nouă</label>
                <input
                  value={newSessionDraft}
                  onChange={(e) => setNewSessionDraft(e.target.value)}
                  placeholder={defaultSessionLabel()}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <button
                type="button"
                onClick={createNewSession}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600"
              >
                Folosește
              </button>
              <button
                type="button"
                onClick={() => setShowNewSession(false)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400"
              >
                Anulează
              </button>
            </div>
          ) : null}

          <p className="text-xs text-zinc-500">
            Upload în: <span className="text-zinc-300">{sessionLabel}</span>
          </p>

          <div>
            <label className="block text-sm text-zinc-400">Fișiere (poți selecta mai multe)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={pending}
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) void uploadMany(files);
              }}
              className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-950 hover:file:bg-emerald-400"
            />
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
              <ul className="flex flex-wrap gap-3">
                {items.map((photo) => (
                  <PhotoThumbCard
                    key={photo.id}
                    photo={photo}
                    write={write}
                    busy={patchingId === photo.id || deletingId === photo.id}
                    onKind={(kind) => void patchPhoto(photo.id, { kind })}
                    onHero={() => void patchPhoto(photo.id, { isHero: !photo.isHero })}
                    onDelete={() => void onDelete(photo.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoThumbCard({
  photo,
  write,
  busy,
  onKind,
  onHero,
  onDelete,
}: {
  photo: VehiclePhotoRow;
  write: boolean;
  busy: boolean;
  onKind: (kind: VehiclePhotoKind | null) => void;
  onHero: () => void;
  onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isImage = IMAGE_EXT.test(photo.fileUrl) || photo.fileUrl.includes("/uploads/");
  const kindLabel = photoKindLabel(photo.kind);

  return (
    <li className="w-[140px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50">
      <a
        href={photo.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-square bg-zinc-900"
        title={photo.caption ?? photo.fileName ?? "Deschide"}
      >
        {!imgError && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.fileUrl}
            alt={photo.caption ?? photo.fileName ?? "Fotografie"}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] text-zinc-500">N/A</span>
        )}
        {photo.isHero ? (
          <span className="absolute left-1 top-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[9px] font-medium text-white">
            Icon
          </span>
        ) : null}
      </a>
      <div className="space-y-1.5 p-2">
        {write ? (
          <select
            value={photo.kind ?? ""}
            disabled={busy}
            onChange={(e) =>
              onKind(e.target.value === "" ? null : (e.target.value as VehiclePhotoKind))
            }
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[10px] text-zinc-200"
          >
            <option value="">Tip…</option>
            {PHOTO_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        ) : kindLabel ? (
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">{kindLabel}</p>
        ) : null}
        {photo.caption ? (
          <p className="truncate text-[10px] text-zinc-400" title={photo.caption}>
            {photo.caption}
          </p>
        ) : null}
        {write ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onHero}
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                photo.isHero
                  ? "bg-emerald-800 text-emerald-100"
                  : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {photo.isHero ? "Icon ✓" : "Set icon"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-zinc-900"
            >
              Șterge
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
