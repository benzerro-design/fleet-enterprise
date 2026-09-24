"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetJsonHeaders, suppliersBrowserBase, type SupplierRecord } from "@/lib/suppliers-api";

type Props = {
  supplier: SupplierRecord;
  canWrite: boolean;
};

/** Program & locație operațională — MVP pe câmpurile Supplier existente (+ notes pentru orar). */
export function SupplierProgramEditor({ supplier, canWrite }: Props) {
  const router = useRouter();
  const [addressLine, setAddressLine] = useState(supplier.addressLine ?? "");
  const [city, setCity] = useState(supplier.city ?? "");
  const [county, setCounty] = useState(supplier.county ?? "");
  const [contactPhone, setContactPhone] = useState(supplier.contactPhone ?? "");
  const [notes, setNotes] = useState(supplier.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!canWrite) {
    return (
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="text-xs text-zinc-500">Adresă atelier</dt>
          <dd className="mt-1 text-zinc-200">{supplier.addressLine ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Oraș / județ</dt>
          <dd className="mt-1 text-zinc-200">
            {[supplier.city, supplier.county].filter(Boolean).join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Telefon</dt>
          <dd className="mt-1 text-zinc-200">{supplier.contactPhone ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-zinc-500">Program / note</dt>
          <dd className="mt-1 whitespace-pre-wrap text-zinc-300">{supplier.notes?.trim() || "—"}</dd>
        </div>
      </dl>
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplier.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          addressLine: addressLine.trim() || null,
          city: city.trim() || null,
          county: county.trim() || null,
          contactPhone: contactPhone.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-500 sm:col-span-2">
          Adresă atelier
          <input
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            className={`${OPS_INPUT_CLASS} mt-1`}
          />
        </label>
        <label className="text-xs text-zinc-500">
          Oraș
          <input value={city} onChange={(e) => setCity(e.target.value)} className={`${OPS_INPUT_CLASS} mt-1`} />
        </label>
        <label className="text-xs text-zinc-500">
          Județ
          <input value={county} onChange={(e) => setCounty(e.target.value)} className={`${OPS_INPUT_CLASS} mt-1`} />
        </label>
        <label className="text-xs text-zinc-500 sm:col-span-2">
          Telefon atelier
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className={`${OPS_INPUT_CLASS} mt-1`}
          />
        </label>
        <label className="text-xs text-zinc-500 sm:col-span-2">
          Program (text liber)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder={"ex. L–V 08:00–17:00\nSâmbătă 08:00–13:00"}
            className={`${OPS_INPUT_CLASS} mt-1`}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Se salvează…" : "Salvează program & locație"}
      </button>
    </div>
  );
}
