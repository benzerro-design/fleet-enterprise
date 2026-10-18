"use client";

import { useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  clientsBrowserBase,
  type ClientSupplierAllocationItem,
} from "@/lib/clients-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { supplierSupportsQuoteDiscountDefaults } from "@/lib/supplier-discount-eligibility";
import { centsToRonInput, type PartsPriceBasis } from "@/lib/supplier-rate-card";

type Props = {
  clientId: string;
  item: ClientSupplierAllocationItem;
  canWrite: boolean;
  onSaved: (item: ClientSupplierAllocationItem) => void;
};

function catalogHint(label: string, value: string) {
  return (
    <span className="mt-1 block text-[11px] text-zinc-600">
      Catalog: {value || "—"} · {label}
    </span>
  );
}

export function ClientSupplierPricingOverlayEditor({
  clientId,
  item,
  canWrite,
  onSaved,
}: Props) {
  const eligible = supplierSupportsQuoteDiscountDefaults(item.category);
  const catalog = item.catalog;
  const overlay = item.overlay;

  const [open, setOpen] = useState(Boolean(item.effective?.overlayActive));
  const [mechanical, setMechanical] = useState(
    centsToRonInput(overlay?.laborRateMechanicalCents),
  );
  const [body, setBody] = useState(centsToRonInput(overlay?.laborRateBodyCents));
  const [paint, setPaint] = useState(centsToRonInput(overlay?.laborRatePaintCents));
  const [diagnostic, setDiagnostic] = useState(
    centsToRonInput(overlay?.laborRateDiagnosticCents),
  );
  const [basis, setBasis] = useState<"" | PartsPriceBasis>(
    overlay?.partsPriceBasis === "net" || overlay?.partsPriceBasis === "list"
      ? overlay.partsPriceBasis
      : "",
  );
  const [parts, setParts] = useState(
    overlay?.partsDiscountPercent != null ? String(overlay.partsDiscountPercent) : "",
  );
  const [labor, setLabor] = useState(
    overlay?.laborDiscountPercent != null ? String(overlay.laborDiscountPercent) : "",
  );
  const [notes, setNotes] = useState(overlay?.pricingNotes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMechanical(centsToRonInput(item.overlay?.laborRateMechanicalCents));
    setBody(centsToRonInput(item.overlay?.laborRateBodyCents));
    setPaint(centsToRonInput(item.overlay?.laborRatePaintCents));
    setDiagnostic(centsToRonInput(item.overlay?.laborRateDiagnosticCents));
    setBasis(
      item.overlay?.partsPriceBasis === "net" || item.overlay?.partsPriceBasis === "list"
        ? item.overlay.partsPriceBasis
        : "",
    );
    setParts(
      item.overlay?.partsDiscountPercent != null
        ? String(item.overlay.partsDiscountPercent)
        : "",
    );
    setLabor(
      item.overlay?.laborDiscountPercent != null
        ? String(item.overlay.laborDiscountPercent)
        : "",
    );
    setNotes(item.overlay?.pricingNotes ?? "");
    setSaved(false);
    setError(null);
  }, [item]);

  if (!eligible) return null;

  async function save() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(
        `${clientsBrowserBase}/${clientId}/supplier-allocations/${item.supplierId}`,
        {
          method: "PATCH",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            laborRateMechanicalRon: mechanical.trim() === "" ? null : mechanical,
            laborRateBodyRon: body.trim() === "" ? null : body,
            laborRatePaintRon: paint.trim() === "" ? null : paint,
            laborRateDiagnosticRon: diagnostic.trim() === "" ? null : diagnostic,
            partsPriceBasis: basis === "" ? null : basis,
            partsDiscountPercent: parts.trim() === "" ? null : parts,
            laborDiscountPercent: labor.trim() === "" ? null : labor,
            pricingNotes: notes.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ClientSupplierAllocationItem;
      onSaved(data);
      setSaved(true);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  const eff = item.effective;
  const active = Boolean(eff?.overlayActive);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-medium text-zinc-200">{item.legalName}</span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">
            {active
              ? "Overlay prețuri activ — prefill WO/deviz folosește tarifele client"
              : "Fără overlay — se folosește catalogul furnizorului"}
            {eff ? (
              <>
                {" "}
                · efectiv piese {eff.partsDiscountPercent}% / manoperă {eff.laborDiscountPercent}%
              </>
            ) : null}
          </span>
        </span>
        <span className="text-xs text-zinc-500">{open ? "Ascunde" : "Prețuri client"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
          <p className="text-xs leading-relaxed text-zinc-500">
            Câmp gol = moștenește fișa tarifară a furnizorului. Valorile de aici au prioritate la
            prefill pe WO / deviz pentru acest client.
          </p>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {saved ? <p className="text-sm text-emerald-400">Overlay salvat.</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={OPS_LABEL_CLASS}>
              Manoperă mecanică (RON/oră)
              <input
                value={mechanical}
                onChange={(e) => setMechanical(e.target.value)}
                disabled={!canWrite || pending}
                className={`${OPS_INPUT_CLASS} mt-1`}
                inputMode="decimal"
                placeholder="moștenește"
              />
              {catalogHint(
                "gol = catalog",
                centsToRonInput(catalog?.laborRateMechanicalCents),
              )}
            </label>
            <label className={OPS_LABEL_CLASS}>
              Tinichigerie (RON/oră)
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={!canWrite || pending}
                className={`${OPS_INPUT_CLASS} mt-1`}
                inputMode="decimal"
                placeholder="moștenește"
              />
              {catalogHint("gol = catalog", centsToRonInput(catalog?.laborRateBodyCents))}
            </label>
            <label className={OPS_LABEL_CLASS}>
              Vopsitorie (RON/oră)
              <input
                value={paint}
                onChange={(e) => setPaint(e.target.value)}
                disabled={!canWrite || pending}
                className={`${OPS_INPUT_CLASS} mt-1`}
                inputMode="decimal"
                placeholder="moștenește"
              />
              {catalogHint("gol = catalog", centsToRonInput(catalog?.laborRatePaintCents))}
            </label>
            <label className={OPS_LABEL_CLASS}>
              Diagnoză (RON/oră)
              <input
                value={diagnostic}
                onChange={(e) => setDiagnostic(e.target.value)}
                disabled={!canWrite || pending}
                className={`${OPS_INPUT_CLASS} mt-1`}
                inputMode="decimal"
                placeholder="moștenește"
              />
              {catalogHint("gol = catalog", centsToRonInput(catalog?.laborRateDiagnosticCents))}
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={OPS_LABEL_CLASS}>
              Bază piese
              <select
                value={basis}
                onChange={(e) => {
                  const v = e.target.value as "" | PartsPriceBasis;
                  setBasis(v);
                  if (v === "net") setParts("0");
                }}
                disabled={!canWrite || pending}
                className={`${OPS_INPUT_CLASS} mt-1`}
              >
                <option value="">Moștenește catalog</option>
                <option value="list">Preț de listă</option>
                <option value="net">Preț net (negociat)</option>
              </select>
              {catalogHint(
                "catalog",
                catalog?.partsPriceBasis === "net" ? "net" : catalog ? "listă" : "",
              )}
            </label>
            <label className={OPS_LABEL_CLASS}>
              Discount piese %
              <input
                value={parts}
                onChange={(e) => setParts(e.target.value)}
                disabled={!canWrite || pending || basis === "net"}
                className={`${OPS_INPUT_CLASS} mt-1`}
                inputMode="decimal"
                placeholder="moștenește"
              />
              {catalogHint(
                "catalog",
                catalog ? `${catalog.partsDiscountPercent}%` : "",
              )}
            </label>
            <label className={OPS_LABEL_CLASS}>
              Discount manoperă %
              <input
                value={labor}
                onChange={(e) => setLabor(e.target.value)}
                disabled={!canWrite || pending}
                className={`${OPS_INPUT_CLASS} mt-1`}
                inputMode="decimal"
                placeholder="moștenește"
              />
              {catalogHint(
                "catalog",
                catalog ? `${catalog.laborDiscountPercent}%` : "",
              )}
            </label>
          </div>

          <label className={OPS_LABEL_CLASS}>
            Note prețuri (client)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canWrite || pending}
              rows={2}
              className={`${OPS_INPUT_CLASS} mt-1`}
              placeholder="opțional"
            />
          </label>

          {canWrite ? (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => void save()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {pending ? "Se salvează…" : "Salvează prețuri client"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
