"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { DOCUMENT_TYPE_OPTIONS } from "@/lib/document-types";

type DocumentRecord = {
  id: string;
  vehicleId: string;
  documentTypeCode: string;
  title: string;
  expiresOn: string | null;
  fileUrl: string | null;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string }
  | { mode: "edit"; documentId: string; initial: DocumentRecord; vehicles: VehicleOption[] };

function toDateInputOrEmpty(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

async function readErrorMessage(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {}
  return msg;
}

export function DocumentForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? props.vehicles[0]?.id ?? "",
        documentTypeCode: "rca",
        title: "",
        expiresOn: "",
        fileUrl: "",
      };
    }
    const r = props.initial;
    return {
      vehicleId: r.vehicleId,
      documentTypeCode: r.documentTypeCode,
      title: r.title,
      expiresOn: toDateInputOrEmpty(r.expiresOn),
      fileUrl: r.fileUrl ?? "",
    };
  }, [props]);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const selectedVehicle = props.vehicles.find((v) => v.id === vehicleId) ?? null;
  const [documentTypeCode, setDocumentTypeCode] = useState(initial.documentTypeCode);
  const [title, setTitle] = useState(initial.title);
  const [expiresOn, setExpiresOn] = useState(initial.expiresOn);
  const [fileUrl, setFileUrl] = useState(initial.fileUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const payload = {
      vehicleId,
      documentTypeCode,
      title: title.trim(),
      expiresOn: expiresOn.trim() ? new Date(expiresOn).toISOString() : null,
      fileUrl: fileUrl.trim() ? fileUrl.trim() : null,
    };

    try {
      const url = isEdit ? `/api/documents/${props.documentId}` : "/api/documents";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res));
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/fleet/documents/${data.id}`);
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-6">
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Vehicul</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        >
          {props.vehicles.length === 0 ? <option value="">Nu există vehicule</option> : null}
          {props.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Client</label>
        <input
          value={selectedVehicle?.clientId ?? ""}
          readOnly
          className="w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Tip document</label>
        <select
          value={documentTypeCode}
          onChange={(e) => setDocumentTypeCode(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        >
          {DOCUMENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Titlu / descriere</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="ex. RCA 2026 — Allianz"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Data expirare (opțional)</label>
        <input
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
        <p className="text-xs text-zinc-500">Lăsat gol dacă documentul nu expiră.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">URL fișier (opțional)</label>
        <input
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
        <p className="text-xs text-zinc-500">Link către scan/PDF (upload direct — fază următoare).</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || props.vehicles.length === 0}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Se salvează…" : isEdit ? "Salvează" : "Adaugă document"}
        </button>
        <Link
          href="/fleet/documents"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
