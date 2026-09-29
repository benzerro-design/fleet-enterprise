"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  fleetJsonHeaders,
  SUPPLIER_CATEGORIES,
  supplierCategoryLabel,
  suppliersBrowserBase,
  type SupplierCategory,
} from "@/lib/suppliers-api";

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Identitate" },
  { id: 2, label: "Categorie" },
  { id: 3, label: "Program" },
  { id: 4, label: "Confirmare" },
];

type Props = {
  serviceCatalog?: unknown;
};

/** PARTNER-002 — wizard creare furnizor: CUI / IBAN → categorie → program. */
export function SupplierOnboardingWizard(_props: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [code, setCode] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [iban, setIban] = useState("");
  const [category, setCategory] = useState<SupplierCategory>("service_auto");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function canNext(): boolean {
    if (step === 1) return Boolean(code.trim() && legalName.trim());
    return true;
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(suppliersBrowserBase, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          code: code.trim(),
          legalName: legalName.trim(),
          taxId: taxId.trim() || null,
          iban: iban.trim() || null,
          category,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          addressLine: addressLine.trim() || null,
          city: city.trim() || null,
          county: county.trim() || null,
          notes: notes.trim() || null,
          status: "active",
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const created = (await res.json()) as { id: string };
      router.push(`/fleet/suppliers/${created.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => s.id <= step && setStep(s.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              step === s.id
                ? "bg-emerald-600/20 font-medium text-emerald-300 ring-1 ring-emerald-700/50"
                : s.id < step
                  ? "text-zinc-300 hover:bg-zinc-900"
                  : "text-zinc-600"
            }`}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      {step === 1 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">
            Cod *
            <input value={code} onChange={(e) => setCode(e.target.value)} className={`${OPS_INPUT_CLASS} mt-1`} />
          </label>
          <label className="text-xs text-zinc-500">
            Denumire legală *
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className={`${OPS_INPUT_CLASS} mt-1`}
            />
          </label>
          <label className="text-xs text-zinc-500">
            CUI / CIF
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={`${OPS_INPUT_CLASS} mt-1`} />
          </label>
          <label className="text-xs text-zinc-500">
            IBAN
            <input value={iban} onChange={(e) => setIban(e.target.value)} className={`${OPS_INPUT_CLASS} mt-1`} />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-500 sm:col-span-2">
            Categorie
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupplierCategory)}
              className={`${OPS_INPUT_CLASS} mt-1`}
            >
              {SUPPLIER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {supplierCategoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Email contact
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={`${OPS_INPUT_CLASS} mt-1`}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Telefon
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={`${OPS_INPUT_CLASS} mt-1`}
            />
          </label>
        </div>
      ) : null}

      {step === 3 ? (
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
            Program / note
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="ex. Luni–Vineri 08:00–17:00"
              className={`${OPS_INPUT_CLASS} mt-1`}
            />
          </label>
        </div>
      ) : null}

      {step === 4 ? (
        <dl className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">Cod / denumire</dt>
            <dd className="mt-1 text-zinc-100">
              {code} — {legalName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">CUI / IBAN</dt>
            <dd className="mt-1 font-mono text-zinc-200">
              {taxId || "—"} / {iban || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Categorie</dt>
            <dd className="mt-1">{supplierCategoryLabel(category)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Contact</dt>
            <dd className="mt-1">{[contactEmail, contactPhone].filter(Boolean).join(" · ") || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500">Locație / program</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-300">
              {[addressLine, [city, county].filter(Boolean).join(", "), notes]
                .filter(Boolean)
                .join("\n") || "—"}
            </dd>
          </div>
        </dl>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi
          </button>
        ) : null}
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext()}
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Continuă
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void submit()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {pending ? "Se creează…" : "Creează furnizorul"}
          </button>
        )}
      </div>
    </div>
  );
}
