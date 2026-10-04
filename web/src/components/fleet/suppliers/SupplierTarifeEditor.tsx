"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { supplierSupportsQuoteDiscountDefaults } from "@/lib/supplier-discount-eligibility";
import { centsToRonInput, type PartsPriceBasis } from "@/lib/supplier-rate-card";
import {
  createSupplierMenuItem,
  deactivateSupplierMenuItem,
  fleetJsonHeaders,
  loadSupplierMenuItems,
  suppliersBrowserBase,
  supplierMenuLineTypeLabel,
  type SupplierMenuItemRecord,
  type SupplierMenuLineType,
  type SupplierRecord,
} from "@/lib/suppliers-api";

type Props = {
  supplier: SupplierRecord;
  canWrite: boolean;
};

function RateField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs text-zinc-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${OPS_INPUT_CLASS} mt-1`}
        inputMode="decimal"
        placeholder="ex. 180"
      />
      {hint ? <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span> : null}
    </label>
  );
}

export function SupplierTarifeEditor({ supplier, canWrite }: Props) {
  const router = useRouter();
  const eligible = supplierSupportsQuoteDiscountDefaults(supplier.category);
  const [mechanical, setMechanical] = useState(centsToRonInput(supplier.laborRateMechanicalCents));
  const [body, setBody] = useState(centsToRonInput(supplier.laborRateBodyCents));
  const [paint, setPaint] = useState(centsToRonInput(supplier.laborRatePaintCents));
  const [diagnostic, setDiagnostic] = useState(centsToRonInput(supplier.laborRateDiagnosticCents));
  const [basis, setBasis] = useState<PartsPriceBasis>(supplier.partsPriceBasis === "net" ? "net" : "list");
  const [parts, setParts] = useState(String(supplier.partsDiscountPercent ?? 0));
  const [labor, setLabor] = useState(String(supplier.laborDiscountPercent ?? 0));
  const [notes, setNotes] = useState(supplier.pricingNotes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [menuItems, setMenuItems] = useState<SupplierMenuItemRecord[]>(supplier.menuItems ?? []);
  const [menuLabel, setMenuLabel] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [menuLineType, setMenuLineType] = useState<SupplierMenuLineType>("other");
  const [menuPending, setMenuPending] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    void loadSupplierMenuItems(supplier.id, { all: canWrite })
      .then((data) => {
        if (!cancelled) setMenuItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setMenuItems(supplier.menuItems ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [supplier.id, supplier.menuItems, canWrite, eligible]);

  if (!eligible) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-6">
        <p className="text-sm text-zinc-300">Fișă tarifară atelier</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Tarife manoperă / discount piese se aplică doar pentru Service auto și Anvelope. Pentru
          carburant, rent, asistență, broker sau asigurător folosiți prețul pe documentul de cost —
          nu un discount de tip atelier.
        </p>
      </div>
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
          laborRateMechanicalRon: mechanical.trim() === "" ? null : mechanical,
          laborRateBodyRon: body.trim() === "" ? null : body,
          laborRatePaintRon: paint.trim() === "" ? null : paint,
          laborRateDiagnosticRon: diagnostic.trim() === "" ? null : diagnostic,
          partsPriceBasis: basis,
          partsDiscountPercent: basis === "net" ? 0 : Number.parseFloat(parts.replace(",", ".")) || 0,
          laborDiscountPercent: Number.parseFloat(labor.replace(",", ".")) || 0,
          pricingNotes: notes.trim() || null,
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

  async function addMenuItem() {
    setMenuPending(true);
    setMenuError(null);
    try {
      const item = await createSupplierMenuItem(supplier.id, {
        label: menuLabel.trim(),
        lineType: menuLineType,
        unitNetRon: menuPrice.trim(),
      });
      setMenuItems((items) => [...items, item].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)));
      setMenuLabel("");
      setMenuPrice("");
      setMenuLineType("other");
      router.refresh();
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Meniul nu a fost salvat");
    } finally {
      setMenuPending(false);
    }
  }

  async function deactivateMenuItem(itemId: string) {
    setMenuPending(true);
    setMenuError(null);
    try {
      await deactivateSupplierMenuItem(supplier.id, itemId);
      setMenuItems((items) => items.map((item) => (item.id === itemId ? { ...item, active: false } : item)));
      router.refresh();
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Meniul nu a fost dezactivat");
    } finally {
      setMenuPending(false);
    }
  }

  if (!canWrite) {
    return (
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-200">1. Manoperă — tarife RON/oră</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Mecanică</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier.laborRateMechanicalCents != null
                  ? `${centsToRonInput(supplier.laborRateMechanicalCents)} RON/oră`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Tinichigerie</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier.laborRateBodyCents != null
                  ? `${centsToRonInput(supplier.laborRateBodyCents)} RON/oră`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Vopsitorie</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier.laborRatePaintCents != null
                  ? `${centsToRonInput(supplier.laborRatePaintCents)} RON/oră`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Diagnoză</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier.laborRateDiagnosticCents != null
                  ? `${centsToRonInput(supplier.laborRateDiagnosticCents)} RON/oră`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-200">2. Piese — bază + negociere</h3>
          <p className="text-sm text-zinc-300">
            Bază: {supplier.partsPriceBasis === "net" ? "preț net (deja negociat)" : "preț de listă"}
          </p>
          <p className="text-sm text-zinc-300">
            Discount piese:{" "}
            {supplier.partsPriceBasis === "net" ? "0% (bază net)" : `${supplier.partsDiscountPercent ?? 0}%`}
          </p>
          <p className="text-sm text-zinc-300">Discount manoperă: {supplier.laborDiscountPercent ?? 0}%</p>
        </section>
        {supplier.pricingNotes ? (
          <p className="text-xs text-zinc-500 whitespace-pre-wrap">{supplier.pricingNotes}</p>
        ) : null}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-200">4. Meniuri atelier</h3>
          {menuItems.filter((item) => item.active).length ? (
            <ul className="space-y-2">
              {menuItems
                .filter((item) => item.active)
                .map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-200">{item.label}</span>
                      <span className="text-xs text-zinc-500">
                        {supplierMenuLineTypeLabel(item.lineType)} · {centsToRonInput(item.unitNetCents)} RON
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Niciun meniu activ.</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">1. Manoperă — ce tarifă atelierul</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Tarife RON/oră pe tip de muncă. Pe linia de deviz tip manoperă, prețul unitar se precompletează
            din tariful mecanic (sau primul tarif completat).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <RateField label="Mecanică (RON/oră)" value={mechanical} onChange={setMechanical} />
          <RateField label="Tinichigerie (RON/oră)" value={body} onChange={setBody} />
          <RateField label="Vopsitorie (RON/oră)" value={paint} onChange={setPaint} />
          <RateField label="Diagnoză (RON/oră)" value={diagnostic} onChange={setDiagnostic} />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">2. Piese — baza prețului</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Discountul are sens doar față de o bază. Alegeți dacă prețul unitar pe linie e de listă
            (apoi aplicați %) sau deja net negociat.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex items-start gap-2 text-sm text-zinc-300">
            <input
              type="radio"
              name="partsBasis"
              className="mt-1"
              checked={basis === "list"}
              onChange={() => setBasis("list")}
            />
            <span>
              <span className="font-medium text-zinc-100">Preț de listă</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Pe linie pui listă; discountul % reduce față de listă (model Audatex / acord flotă).
              </span>
            </span>
          </label>
          <label className="inline-flex items-start gap-2 text-sm text-zinc-300">
            <input
              type="radio"
              name="partsBasis"
              className="mt-1"
              checked={basis === "net"}
              onChange={() => setBasis("net")}
            />
            <span>
              <span className="font-medium text-zinc-100">Preț net negociat</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Unitatea pe linie e deja prețul plătit; discount default = 0%.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">3. Negociere (discount)</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Nu e „tariful” atelierului — e reducerea negociată față de baza de mai sus. Manoperă: folosiți
            % doar dacă păstrați un tarif listă și un net flotă; altfel lăsați 0 și puneți tariful/oră real
            la punctul 1.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">
            Discount piese (%)
            <input
              value={basis === "net" ? "0" : parts}
              onChange={(e) => setParts(e.target.value)}
              disabled={basis === "net"}
              className={`${OPS_INPUT_CLASS} mt-1 disabled:opacity-50`}
              inputMode="decimal"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Discount manoperă (%)
            <input
              value={labor}
              onChange={(e) => setLabor(e.target.value)}
              className={`${OPS_INPUT_CLASS} mt-1`}
              inputMode="decimal"
            />
          </label>
        </div>
      </section>

      <label className="block text-xs text-zinc-500">
        Note acord (opțional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${OPS_INPUT_CLASS} mt-1`}
          placeholder="ex. Acord 2026: mecanică 180 RON/h, piese −12% față de listă Stahlgruber…"
        />
      </label>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">4. Meniuri atelier</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Operațiuni fixe (ITP, schimb ulei etc.) ce pot fi adăugate rapid pe deviz.
          </p>
        </div>

        {menuItems.length ? (
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                  item.active
                    ? "border-zinc-800 bg-zinc-950/50"
                    : "border-zinc-900 bg-zinc-950/30 opacity-60"
                }`}
              >
                <span className="min-w-[12rem] flex-1">
                  <span className="block text-sm text-zinc-200">{item.label}</span>
                  <span className="text-xs text-zinc-500">
                    {supplierMenuLineTypeLabel(item.lineType)} · {centsToRonInput(item.unitNetCents)} RON
                    {!item.active ? " · inactiv" : ""}
                  </span>
                </span>
                {item.active ? (
                  <button
                    type="button"
                    disabled={menuPending}
                    onClick={() => void deactivateMenuItem(item.id)}
                    className="rounded-lg border border-red-800/60 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Dezactivează
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-500">
            Niciun meniu definit.
          </p>
        )}

        <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
          <label className="text-xs text-zinc-500">
            Denumire
            <input
              value={menuLabel}
              onChange={(e) => setMenuLabel(e.target.value)}
              className={`${OPS_INPUT_CLASS} mt-1`}
              placeholder="ex. ITP"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Preț net (RON)
            <input
              value={menuPrice}
              onChange={(e) => setMenuPrice(e.target.value)}
              className={`${OPS_INPUT_CLASS} mt-1`}
              inputMode="decimal"
              placeholder="ex. 150"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Tip linie
            <select
              value={menuLineType}
              onChange={(e) => setMenuLineType(e.target.value as SupplierMenuLineType)}
              className={`${OPS_INPUT_CLASS} mt-1`}
            >
              <option value="parts">Piese</option>
              <option value="labor">Manoperă</option>
              <option value="other">Altele</option>
            </select>
          </label>
          <button
            type="button"
            disabled={menuPending || !menuLabel.trim() || !menuPrice.trim()}
            onClick={() => void addMenuItem()}
            className="rounded-lg border border-violet-500/50 bg-violet-950/40 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-950/60 disabled:opacity-50"
          >
            Adaugă
          </button>
        </div>
        {menuError ? <p className="text-sm text-red-400">{menuError}</p> : null}
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Se salvează…" : "Salvează fișa tarifară"}
      </button>
    </div>
  );
}
