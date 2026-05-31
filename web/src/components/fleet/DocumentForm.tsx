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
    <form onSubmit={(e) => void onSubmit(e)} className="flex max-w-xl flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Vehicul</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          required
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {props.vehicles.length === 0 ? (
            <option value="">Niciun vehicul</option>
          ) : (
            props.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registrationNumber} · {v.clientId}
              </option>
            ))
          )}
        </select>
        {selectedVehicle ? (
          <p className="text-xs text-zinc-500">Client: {selectedVehicle.clientId}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Tip document</label>
        <select
          value={documentTypeCode}
          onChange={(e) => setDocumentTypeCode(e.target.value)}
          required
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {DOCUMENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Titlu / descriere</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="ex. RCA 2026 — Allianz"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Data expirare (opțional)</label>
        <input
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">Lăsat gol dacă documentul nu expiră.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">URL fișier (opțional)</label>
        <input
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://…"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">Link către scan/PDF (upload direct — fază următoare).</p>
      </div>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

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
