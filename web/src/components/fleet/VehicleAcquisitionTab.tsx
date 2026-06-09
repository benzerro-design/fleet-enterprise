"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ACQUISITION_TYPES, acquisitionTypeLabel } from "@/lib/acquisition-types";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import { formatRonFromCents, parseRonToCents } from "@/lib/money";
import type { AcquisitionType, VehicleAcquisitionPayload } from "@/lib/vehicle-profile-types";

type Props = {
  vehicleId: string;
  write: boolean;
  initial: VehicleAcquisitionPayload;
};

function isoDateOnly(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function dateToIso(date: string): string | null {
  if (!date.trim()) return null;
  return `${date}T12:00:00.000Z`;
}

function centsToInput(cents: number | null): string {
  if (cents === null || cents === undefined) return "";
  return formatRonFromCents(cents).replace(/\s*RON$/, "").trim();
}

function inputToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return parseRonToCents(trimmed);
}

export function VehicleAcquisitionTab({ vehicleId, write, initial }: Props) {
  const router = useRouter();
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType | "">(initial.acquisitionType ?? "");
  const [acquiredOn, setAcquiredOn] = useState(isoDateOnly(initial.acquiredOn));
  const [dealerName, setDealerName] = useState(initial.dealerName ?? "");
  const [financierName, setFinancierName] = useState(initial.financierName ?? "");
  const [purchasePrice, setPurchasePrice] = useState(centsToInput(initial.purchasePriceCents));
  const [downPayment, setDownPayment] = useState(centsToInput(initial.downPaymentCents));
  const [contractNumber, setContractNumber] = useState(initial.contractNumber ?? "");
  const [contractStartOn, setContractStartOn] = useState(isoDateOnly(initial.contractStartOn));
  const [contractEndOn, setContractEndOn] = useState(isoDateOnly(initial.contractEndOn));
  const [monthlyPayment, setMonthlyPayment] = useState(centsToInput(initial.monthlyPaymentCents));
  const [residualValue, setResidualValue] = useState(centsToInput(initial.residualValueCents));
  const [warrantyExpiresOn, setWarrantyExpiresOn] = useState(isoDateOnly(initial.warrantyExpiresOn));
  const [warrantyKmLimit, setWarrantyKmLimit] = useState(
    initial.warrantyKmLimit !== null ? String(initial.warrantyKmLimit) : "",
  );
  const [warrantyProvider, setWarrantyProvider] = useState(initial.warrantyProvider ?? "");
  const [acquisitionNotes, setAcquisitionNotes] = useState(initial.acquisitionNotes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isLeasing = acquisitionType === "financial_leasing" || acquisitionType === "operational_leasing";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/acquisition`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          acquisitionType: acquisitionType || null,
          acquiredOn: dateToIso(acquiredOn),
          dealerName: dealerName.trim() || null,
          financierName: financierName.trim() || null,
          purchasePriceCents: inputToCents(purchasePrice),
          downPaymentCents: inputToCents(downPayment),
          contractNumber: contractNumber.trim() || null,
          contractStartOn: dateToIso(contractStartOn),
          contractEndOn: dateToIso(contractEndOn),
          monthlyPaymentCents: inputToCents(monthlyPayment),
          residualValueCents: inputToCents(residualValue),
          warrantyExpiresOn: dateToIso(warrantyExpiresOn),
          warrantyKmLimit: warrantyKmLimit.trim() ? Math.round(Number(warrantyKmLimit)) : null,
          warrantyProvider: warrantyProvider.trim() || null,
          acquisitionNotes: acquisitionNotes.trim() || null,
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
      setSaved(true);
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  if (!write) {
    return (
      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label="Tip achiziție" value={acquisitionTypeLabel(initial.acquisitionType)} />
        <Field
          label="Data achiziției"
          value={initial.acquiredOn ? new Date(initial.acquiredOn).toLocaleDateString("ro-RO") : "—"}
        />
        <Field label="Dealer auto" value={initial.dealerName ?? "—"} />
        <Field label="Finanțator" value={initial.financierName ?? "—"} />
        <Field
          label="Preț achiziție"
          value={initial.purchasePriceCents !== null ? formatRonFromCents(initial.purchasePriceCents) : "—"}
          mono
        />
        {isLeasing || initial.downPaymentCents !== null ? (
          <Field
            label="Avans"
            value={initial.downPaymentCents !== null ? formatRonFromCents(initial.downPaymentCents) : "—"}
            mono
          />
        ) : null}
        {isLeasing || initial.contractNumber ? (
          <>
            <Field label="Nr. contract" value={initial.contractNumber ?? "—"} mono />
            <Field
              label="Început contract"
              value={
                initial.contractStartOn ? new Date(initial.contractStartOn).toLocaleDateString("ro-RO") : "—"
              }
            />
            <Field
              label="Sfârșit contract"
              value={initial.contractEndOn ? new Date(initial.contractEndOn).toLocaleDateString("ro-RO") : "—"}
            />
            <Field
              label="Rată lunară"
              value={initial.monthlyPaymentCents !== null ? formatRonFromCents(initial.monthlyPaymentCents) : "—"}
              mono
            />
            <Field
              label="Valoare reziduală"
              value={initial.residualValueCents !== null ? formatRonFromCents(initial.residualValueCents) : "—"}
              mono
            />
          </>
        ) : null}
        <div className="sm:col-span-2 border-t border-zinc-800 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Garanție vehicul</p>
        </div>
        <Field label="Furnizor garanție" value={initial.warrantyProvider ?? "—"} />
        <Field
          label="Garanție expiră"
          value={initial.warrantyExpiresOn ? new Date(initial.warrantyExpiresOn).toLocaleDateString("ro-RO") : "—"}
        />
        <Field
          label="Limită km garanție"
          value={initial.warrantyKmLimit !== null ? `${initial.warrantyKmLimit.toLocaleString("ro-RO")} km` : "—"}
          mono
        />
        {initial.acquisitionNotes ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Notițe</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-200">{initial.acquisitionNotes}</dd>
          </div>
        ) : null}
      </dl>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
      <p className="text-sm text-zinc-400">
        Date de achiziție — dealer, finanțare și garanție. Câmpurile de leasing apar când tipul este leasing
        financiar sau operațional.
      </p>
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Salvat.
        </p>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-zinc-300">Achiziție</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Tip achiziție"
            value={acquisitionType}
            onChange={(v) => setAcquisitionType(v as AcquisitionType | "")}
            options={[{ value: "", label: "— Nespecificat —" }, ...ACQUISITION_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
          />
          <Input label="Data achiziției" type="date" value={acquiredOn} onChange={setAcquiredOn} />
          <Input label="Dealer auto" value={dealerName} onChange={setDealerName} />
          <Input
            label="Finanțator"
            value={financierName}
            onChange={setFinancierName}
            hint={isLeasing ? "Bancă sau societate de leasing" : "Opțional — dacă există finanțare"}
          />
          <Input
            label="Preț achiziție (RON)"
            value={purchasePrice}
            onChange={setPurchasePrice}
            mono
            hint="Valoare totală vehicul"
          />
          {isLeasing ? (
            <Input label="Avans (RON)" value={downPayment} onChange={setDownPayment} mono />
          ) : null}
        </div>
      </section>

      {isLeasing ? (
        <section className="space-y-4 rounded-lg border border-violet-900/30 bg-violet-950/10 p-4">
          <h3 className="text-sm font-medium text-violet-200">Contract leasing</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nr. contract" value={contractNumber} onChange={setContractNumber} mono />
            <div className="hidden sm:block" />
            <Input label="Început contract" type="date" value={contractStartOn} onChange={setContractStartOn} />
            <Input label="Sfârșit contract" type="date" value={contractEndOn} onChange={setContractEndOn} />
            <Input label="Rată lunară (RON)" value={monthlyPayment} onChange={setMonthlyPayment} mono />
            <Input label="Valoare reziduală (RON)" value={residualValue} onChange={setResidualValue} mono />
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-lg border border-amber-900/30 bg-amber-950/10 p-4">
        <h3 className="text-sm font-medium text-amber-200">Garanție vehicul</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Furnizor garanție" value={warrantyProvider} onChange={setWarrantyProvider} hint="Producător, dealer sau asigurător" />
          <Input label="Garanție expiră" type="date" value={warrantyExpiresOn} onChange={setWarrantyExpiresOn} />
          <Input
            label="Limită km garanție"
            type="number"
            value={warrantyKmLimit}
            onChange={setWarrantyKmLimit}
            mono
            hint="Km maxim acoperiți de garanție"
          />
        </div>
      </section>

      <div>
        <label className="block text-sm font-medium text-zinc-300">Notițe achiziție</label>
        <textarea
          value={acquisitionNotes}
          onChange={(e) => setAcquisitionNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="Observații contract, condiții speciale…"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? "Salvez…" : "Salvează date achiziție"}
      </button>
    </form>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={`mt-1 text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  mono,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 ${mono ? "font-mono" : ""}`}
      />
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
      >
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
