"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  OPS_INPUT_CLASS,
  OpsFormField,
  OpsFormSection,
  OpsFormStickyActions,
} from "@/components/fleet/ops-form-primitives";
import {
  fleetJsonHeaders,
  SUPPLIER_CATEGORIES,
  supplierCategoryLabel,
  supplierServiceLabel,
  suppliersBrowserBase,
  type SupplierCategory,
  type SupplierRecord,
  type SupplierServiceKind,
  type SupplierStatus,
} from "@/lib/suppliers-api";
import { SupplierServicesEditor } from "@/components/fleet/SupplierServicesEditor";

type Props = {
  mode: "create" | "edit";
  initial?: SupplierRecord;
  serviceCatalog: import("@/lib/supplier-service-catalog").SupplierServiceCatalogEntry[];
};

export function SupplierForm({ mode, initial, serviceCatalog }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [category, setCategory] = useState<SupplierCategory>(initial?.category ?? "service_auto");
  const [status, setStatus] = useState<SupplierStatus>(initial?.status ?? "active");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [county, setCounty] = useState(initial?.county ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [services, setServices] = useState<SupplierServiceKind[]>(initial?.services ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      code: code.trim(),
      legalName: legalName.trim(),
      taxId: taxId.trim() || null,
      category,
      status,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      addressLine: addressLine.trim() || null,
      city: city.trim() || null,
      county: county.trim() || null,
      notes: notes.trim() || null,
      services,
    };
    try {
      const url =
        mode === "create" ? suppliersBrowserBase : `${suppliersBrowserBase}/${initial!.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const saved = (await res.json()) as SupplierRecord;
      router.push(mode === "create" ? `/fleet/suppliers/${saved.id}` : `/fleet/suppliers/${initial!.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-3xl space-y-6">
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      <OpsFormSection number={1} title="Identificare">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OpsFormField label="Cod" required>
            <input required value={code} onChange={(e) => setCode(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
          <OpsFormField label="Denumire legală" required>
            <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
          <OpsFormField label="CUI">
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
          <OpsFormField label="Categorie">
            <select value={category} onChange={(e) => setCategory(e.target.value as SupplierCategory)} className={OPS_INPUT_CLASS}>
              {SUPPLIER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {supplierCategoryLabel(c)}
                </option>
              ))}
            </select>
          </OpsFormField>
          <OpsFormField label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as SupplierStatus)} className={OPS_INPUT_CLASS}>
              <option value="active">Activ</option>
              <option value="inactive">Inactiv</option>
              <option value="blocked">Blocat</option>
            </select>
          </OpsFormField>
        </div>
      </OpsFormSection>
      <OpsFormSection number={2} title="Contact">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OpsFormField label="Email">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
          <OpsFormField label="Telefon">
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
          <OpsFormField label="Adresă">
            <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
          <OpsFormField label="Oraș">
            <input value={city} onChange={(e) => setCity(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
          <OpsFormField label="Județ">
            <input value={county} onChange={(e) => setCounty(e.target.value)} className={OPS_INPUT_CLASS} />
          </OpsFormField>
        </div>
      </OpsFormSection>
      <OpsFormSection number={3} title="Servicii prestate">
        {mode === "edit" && initial ? (
          <SupplierServicesEditor
            supplierId={initial.id}
            catalog={serviceCatalog}
            initialSelected={services}
            canWrite
            assignedByLabel="Administrator flotă"
            onSaved={setServices}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {serviceCatalog.map((entry) => {
              const active = services.includes(entry.kind);
              return (
                <button
                  key={entry.kind}
                  type="button"
                  onClick={() =>
                    setServices((prev) =>
                      prev.includes(entry.kind)
                        ? prev.filter((k) => k !== entry.kind)
                        : [...prev, entry.kind],
                    )
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    active
                      ? "border-violet-600 bg-violet-950/40 text-violet-200"
                      : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        )}
      </OpsFormSection>
      <OpsFormField label="Notițe">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={OPS_INPUT_CLASS} />
      </OpsFormField>
      <OpsFormStickyActions
        submitLabel={mode === "create" ? "Creează furnizorul" : "Salvează"}
        pendingLabel="Salvez…"
        cancelHref={mode === "edit" ? `/fleet/suppliers/${initial!.id}` : "/fleet/suppliers"}
        pending={pending}
      />
    </form>
  );
}
