"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import { uploadDocumentFile } from "@/lib/document-upload";
import {
  EMPTY_LEGISLATIVE_KIT,
  LEGISLATIVE_KIT_PHOTO_KINDS,
  legislativeKitPhotoKindLabel,
  type LegislativeKitPhotoKind,
  type VehicleLegislativeKit,
  type VehicleLegislativeKitPayload,
} from "@/lib/vehicle-legislative-kit";

type Props = {
  vehicleId: string;
  write: boolean;
  initial: VehicleLegislativeKitPayload;
};

const EXTINGUISHER_TYPES = ["Pulbere ABC", "CO₂", "Spumă", "Alt tip"];
const MEDICAL_TYPES = ["Standard auto", "Extinsă", "Alt tip"];

export function VehicleLegislativeKitTab({ vehicleId, write, initial }: Props) {
  const router = useRouter();
  const [kit, setKit] = useState<VehicleLegislativeKit>(initial.kit ?? EMPTY_LEGISLATIVE_KIT);
  const [spareWheelPresent, setSpareWheelPresent] = useState(initial.spareWheelPresent);
  const [photos, setPhotos] = useState(initial.photos ?? []);
  const [pending, setPending] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<LegislativeKitPhotoKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileRefs = useRef<Partial<Record<LegislativeKitPhotoKind, HTMLInputElement | null>>>({});

  const photosByKind = useMemo(() => {
    const map = new Map<LegislativeKitPhotoKind, typeof photos>();
    for (const kind of LEGISLATIVE_KIT_PHOTO_KINDS) map.set(kind, []);
    for (const photo of photos) {
      if (!photo.kind || !LEGISLATIVE_KIT_PHOTO_KINDS.includes(photo.kind as LegislativeKitPhotoKind)) continue;
      const list = map.get(photo.kind as LegislativeKitPhotoKind) ?? [];
      list.push(photo);
      map.set(photo.kind as LegislativeKitPhotoKind, list);
    }
    return map;
  }, [photos]);

  async function save(next: VehicleLegislativeKit) {
    if (!write) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/legislative-kit`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as VehicleLegislativeKitPayload;
      setKit(data.kit);
      setSpareWheelPresent(data.spareWheelPresent);
      setPhotos(data.photos);
      setInfo("Kit legislativ salvat.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvare eșuată.");
    } finally {
      setPending(false);
    }
  }

  async function uploadForKind(kind: LegislativeKitPhotoKind, files: FileList | null) {
    if (!write || !files?.length) return;
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setError("Selectează imagini (JPEG, PNG, WebP).");
      return;
    }
    setUploadingKind(kind);
    setError(null);
    setInfo(null);
    const added: typeof photos = [];
    try {
      for (const file of list) {
        const uploaded = await uploadDocumentFile(file, null);
        const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/photos`, {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            fileUrl: uploaded.url,
            fileName: uploaded.name,
            sessionLabel: "Kit legislativ",
            kind,
            caption: legislativeKitPhotoKindLabel(kind),
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? `HTTP ${res.status}`);
        }
        added.push(await res.json());
      }
      setPhotos((prev) => [...added, ...prev]);
      setInfo(`${added.length} poză/poze adăugate la ${legislativeKitPhotoKindLabel(kind)}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Încărcare eșuată.");
      if (added.length) setPhotos((prev) => [...added, ...prev]);
    } finally {
      setUploadingKind(null);
      const input = fileRefs.current[kind];
      if (input) input.value = "";
    }
  }

  const punctureConflict = kit.punctureKitPresent && spareWheelPresent;
  const punctureMissing = !kit.punctureKitPresent && !spareWheelPresent;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Kit legislativ</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Stingător, trusă medicală, kit de pană, triunghi și vestă — editabil pentru șofer, manager client și
          admin. Poze pe fiecare element.
        </p>
      </div>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-400">{info}</p> : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">Stingător</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-500">
            Tip
            <input
              list="kit-extinguisher-types"
              disabled={!write || pending}
              className={`mt-1 w-full ${OPS_INPUT_CLASS}`}
              value={kit.extinguisher.type ?? ""}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  extinguisher: { ...k.extinguisher, type: e.target.value || null },
                }))
              }
              placeholder="ex. Pulbere ABC"
            />
            <datalist id="kit-extinguisher-types">
              {EXTINGUISHER_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs text-zinc-500">
            Data expirare
            <input
              type="date"
              disabled={!write || pending}
              className={`mt-1 w-full ${OPS_INPUT_CLASS}`}
              value={kit.extinguisher.expiresOn ?? ""}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  extinguisher: { ...k.extinguisher, expiresOn: e.target.value || null },
                }))
              }
            />
          </label>
        </div>
        <PhotoBlock
          kind="kit_extinguisher"
          write={write}
          uploading={uploadingKind === "kit_extinguisher"}
          photos={photosByKind.get("kit_extinguisher") ?? []}
          fileRef={(el) => {
            fileRefs.current.kit_extinguisher = el;
          }}
          onPick={(files) => void uploadForKind("kit_extinguisher", files)}
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">Trusă medicală</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-500">
            Tip
            <input
              list="kit-medical-types"
              disabled={!write || pending}
              className={`mt-1 w-full ${OPS_INPUT_CLASS}`}
              value={kit.medicalKit.type ?? ""}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  medicalKit: { ...k.medicalKit, type: e.target.value || null },
                }))
              }
              placeholder="ex. Standard auto"
            />
            <datalist id="kit-medical-types">
              {MEDICAL_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs text-zinc-500">
            Data expirare
            <input
              type="date"
              disabled={!write || pending}
              className={`mt-1 w-full ${OPS_INPUT_CLASS}`}
              value={kit.medicalKit.expiresOn ?? ""}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  medicalKit: { ...k.medicalKit, expiresOn: e.target.value || null },
                }))
              }
            />
          </label>
        </div>
        <PhotoBlock
          kind="kit_medical"
          write={write}
          uploading={uploadingKind === "kit_medical"}
          photos={photosByKind.get("kit_medical") ?? []}
          fileRef={(el) => {
            fileRefs.current.kit_medical = el;
          }}
          onPick={(files) => void uploadForKind("kit_medical", files)}
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">Kit de pană</h3>
        <label className="flex items-start gap-3 text-sm text-zinc-200">
          <input
            type="checkbox"
            disabled={!write || pending}
            className="mt-1 h-4 w-4 rounded border-zinc-600"
            checked={kit.punctureKitPresent}
            onChange={(e) => setKit((k) => ({ ...k, punctureKitPresent: e.target.checked }))}
          />
          <span>
            Vehiculul are kit de pană (în loc de roată de rezervă)
            <span className="mt-1 block text-xs text-zinc-500">
              Corelat cu tab-ul{" "}
              <Link href={`?tab=wheels`} className="text-emerald-400 hover:underline">
                Roti
              </Link>
              : {spareWheelPresent ? "roată de rezervă înregistrată" : "fără roată de rezervă pe Roti"}.
            </span>
          </span>
        </label>
        {punctureMissing ? (
          <p className="text-xs text-amber-300">
            Nu există roată de rezervă pe Roti — bifează kitul de pană dacă mașina e echipată cu el.
          </p>
        ) : null}
        {punctureConflict ? (
          <p className="text-xs text-amber-300">
            Pe Roti există roată de rezervă, iar kitul de pană e bifat. Verifică care e echiparea reală.
          </p>
        ) : null}
        <PhotoBlock
          kind="kit_puncture"
          write={write}
          uploading={uploadingKind === "kit_puncture"}
          photos={photosByKind.get("kit_puncture") ?? []}
          fileRef={(el) => {
            fileRefs.current.kit_puncture = el;
          }}
          onPick={(files) => void uploadForKind("kit_puncture", files)}
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">Triunghi reflectorizant</h3>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              disabled={!write || pending}
              className="h-4 w-4 rounded border-zinc-600"
              checked={kit.triangle.present}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  triangle: {
                    present: e.target.checked,
                    quantity: e.target.checked ? k.triangle.quantity ?? 1 : null,
                  },
                }))
              }
            />
            Există
          </label>
          <label className="block text-xs text-zinc-500">
            Bucăți
            <input
              type="number"
              min={0}
              max={99}
              disabled={!write || pending || !kit.triangle.present}
              className={`mt-1 w-24 ${OPS_INPUT_CLASS}`}
              value={kit.triangle.quantity ?? ""}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  triangle: {
                    ...k.triangle,
                    quantity: e.target.value === "" ? null : Number(e.target.value),
                  },
                }))
              }
            />
          </label>
        </div>
        <PhotoBlock
          kind="kit_triangle"
          write={write}
          uploading={uploadingKind === "kit_triangle"}
          photos={photosByKind.get("kit_triangle") ?? []}
          fileRef={(el) => {
            fileRefs.current.kit_triangle = el;
          }}
          onPick={(files) => void uploadForKind("kit_triangle", files)}
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">Vestă reflectorizantă</h3>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              disabled={!write || pending}
              className="h-4 w-4 rounded border-zinc-600"
              checked={kit.vest.present}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  vest: {
                    present: e.target.checked,
                    quantity: e.target.checked ? k.vest.quantity ?? 1 : null,
                  },
                }))
              }
            />
            Există
          </label>
          <label className="block text-xs text-zinc-500">
            Bucăți
            <input
              type="number"
              min={0}
              max={99}
              disabled={!write || pending || !kit.vest.present}
              className={`mt-1 w-24 ${OPS_INPUT_CLASS}`}
              value={kit.vest.quantity ?? ""}
              onChange={(e) =>
                setKit((k) => ({
                  ...k,
                  vest: {
                    ...k.vest,
                    quantity: e.target.value === "" ? null : Number(e.target.value),
                  },
                }))
              }
            />
          </label>
        </div>
        <PhotoBlock
          kind="kit_vest"
          write={write}
          uploading={uploadingKind === "kit_vest"}
          photos={photosByKind.get("kit_vest") ?? []}
          fileRef={(el) => {
            fileRefs.current.kit_vest = el;
          }}
          onPick={(files) => void uploadForKind("kit_vest", files)}
        />
      </section>

      <label className="block text-xs text-zinc-500">
        Notițe
        <textarea
          disabled={!write || pending}
          rows={3}
          className={`mt-1 w-full ${OPS_INPUT_CLASS}`}
          value={kit.notes ?? ""}
          onChange={(e) => setKit((k) => ({ ...k, notes: e.target.value || null }))}
        />
      </label>

      {write ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void save(kit)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          {pending ? "Salvez…" : "Salvează kitul"}
        </button>
      ) : (
        <p className="text-xs text-zinc-500">Doar vizualizare.</p>
      )}
    </div>
  );
}

function PhotoBlock({
  kind,
  write,
  uploading,
  photos,
  fileRef,
  onPick,
}: {
  kind: LegislativeKitPhotoKind;
  write: boolean;
  uploading: boolean;
  photos: VehicleLegislativeKitPayload["photos"];
  fileRef: (el: HTMLInputElement | null) => void;
  onPick: (files: FileList | null) => void;
}) {
  const inputId = `kit-photo-${kind}`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Poze · {legislativeKitPhotoKindLabel(kind)}</p>
        {write ? (
          <>
            <input
              id={inputId}
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => onPick(e.target.files)}
            />
            <label
              htmlFor={inputId}
              className={`cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 ${
                uploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {uploading ? "Încarc…" : "+ Poză"}
            </label>
          </>
        ) : null}
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-zinc-600">Nicio poză.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={p.fileUrl} target="_blank" rel="noreferrer">
                <img src={p.fileUrl} alt={p.caption ?? kind} className="aspect-square w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
