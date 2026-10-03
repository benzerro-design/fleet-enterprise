"use client";

import { useEffect, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_DAMAGE_PIPELINE_STEPS,
  normalizeDamagePipelineSteps,
  type DamagePipelineStepSetting,
  type ServiceTypeSettings,
  type ServiceTypeSettingsKey,
  type WorkshopStatusSetting,
  type WorkOrderSettings,
  workOrderSettingsBrowserBase,
} from "@/lib/work-order-settings";
import {
  SERVICE_ORDER_TYPES,
  type ServiceOrderTypeCode,
} from "@/lib/work-order-sheet";

type Props = {
  initial: WorkOrderSettings;
};

type TabId = "general" | ServiceOrderTypeCode;

function newSlug(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `pas_${Date.now().toString(36)}`;
}

export function WorkOrderSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [tab, setTab] = useState<TabId>("general");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [damageStepsDraft, setDamageStepsDraft] = useState<DamagePipelineStepSetting[]>(() =>
    normalizeDamagePipelineSteps(initial.damagePipelineSteps),
  );
  const [newStepLabel, setNewStepLabel] = useState("");

  async function patch(partial: Partial<WorkOrderSettings>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(workOrderSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as WorkOrderSettings;
      setSettings(next);
      if (partial.damagePipelineSteps) {
        setDamageStepsDraft(normalizeDamagePipelineSteps(next.damagePipelineSteps));
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  function patchNumber(key: keyof WorkOrderSettings, value: string) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) return;
    void patch({ [key]: n } as Partial<WorkOrderSettings>);
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "general", label: "Setări generale" },
    ...SERVICE_ORDER_TYPES.map((t) => ({ id: t.code as TabId, label: `${t.code} · ${t.label}` })),
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-zinc-800 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === t.id
                ? "bg-violet-950/50 text-violet-100 ring-1 ring-violet-500/40"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      {tab === "general" ? (
        <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Recepție & odometru</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Controlează marcarea In/Out service pe comenzi (inclusiv portal partener).
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.requireServiceKm}
              disabled={pending}
              onChange={(e) => void patch({ requireServiceKm: e.target.checked })}
            />
            <span>
              <span className="font-medium text-zinc-100">Obligativitate km in și km out</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Da = nu se poate marca In/Out service fără km completat.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.updateFleetOdometerFromServiceKm}
              disabled={pending}
              onChange={(e) => void patch({ updateFleetOdometerFromServiceKm: e.target.checked })}
            />
            <span>
              <span className="font-medium text-zinc-100">Km in / km out modifică odometrul flotă</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Da = actualizează odometrul vehiculului doar dacă noul km ≥ km curent (citire ops pe comandă).
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.allowDriverServiceOut}
              disabled={pending}
              onChange={(e) => void patch({ allowDriverServiceOut: e.target.checked })}
            />
            <span>
              <span className="font-medium text-zinc-100">Șoferul poate marca Service Out</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Da = pe comenzile vehiculelor alocate, șoferul poate marca Out (km + poze), la fel ca
                partenerul. Ops și atelier rămân oricum. Implicit oprit.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.requirePartCode}
              disabled={pending}
              onChange={(e) => void patch({ requirePartCode: e.target.checked })}
            />
            <span>
              <span className="font-medium text-zinc-100">Cod piesă obligatoriu în deviz</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Da = liniile de tip piese au nevoie de cod, cu excepția marcajului explicit „fără cod”.
              </span>
            </span>
          </label>

          <div>
            <h2 className="text-sm font-medium text-zinc-200">Garanție (defaults)</h2>
            <p className="mt-1 text-xs text-zinc-500">Valori implicite la importul liniilor în tab-ul Garanție.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm text-zinc-300">
              <span className="font-medium text-zinc-100">Garanție piese (luni)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                value={settings.defaultPartsWarrantyMonths}
                disabled={pending}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    defaultPartsWarrantyMonths: parseInt(e.target.value, 10) || 0,
                  }))
                }
                onBlur={(e) => patchNumber("defaultPartsWarrantyMonths", e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-300">
              <span className="font-medium text-zinc-100">Garanție piese (km)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                value={settings.defaultPartsWarrantyKm}
                disabled={pending}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, defaultPartsWarrantyKm: parseInt(e.target.value, 10) || 0 }))
                }
                onBlur={(e) => patchNumber("defaultPartsWarrantyKm", e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-300">
              <span className="font-medium text-zinc-100">Garanție manoperă (luni)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                value={settings.defaultLaborWarrantyMonths}
                disabled={pending}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    defaultLaborWarrantyMonths: parseInt(e.target.value, 10) || 0,
                  }))
                }
                onBlur={(e) => patchNumber("defaultLaborWarrantyMonths", e.target.value)}
              />
            </label>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-200">Import · verificare · comenzi</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Reguli pe WO. Conectorii se activează separat în Setup → Integrări.
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.allowQuotePdfImport}
              disabled={pending}
              onChange={(e) => void patch({ allowQuotePdfImport: e.target.checked })}
            />
            <span>
              <span className="font-medium text-zinc-100">Permite Import PDF pe comandă</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Buton „Import deviz PDF” (necesită și Integrări → Import Audatex).
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.allowPartsPriceVerify}
              disabled={pending}
              onChange={(e) => void patch({ allowPartsPriceVerify: e.target.checked })}
            />
            <span>
              <span className="font-medium text-zinc-100">Permite verificare preț piese</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Buton „Verifică preț” pe deviz (necesită catalog activ în Integrări).
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.allowPartsOrderLaunch}
              disabled={pending}
              onChange={(e) => void patch({ allowPartsOrderLaunch: e.target.checked })}
            />
            <span>
              <span className="font-medium text-zinc-100">Permite lansare comenzi piese</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Buton pe Deviz aprobat — doar admin client/tenant sau partener atelier (nu dispatcher).
                Necesită și Setup → Integrări.
              </span>
            </span>
          </label>

          <label className="space-y-1 text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">Prag preț suspect (%)</span>
            <span className="block text-xs text-zinc-500">
              % peste cel mai ieftin preț din catalog. Override opțional pe Client → Prețuri.
            </span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full max-w-[8rem] rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={settings.partsPriceSuspectPercent}
              disabled={pending}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  partsPriceSuspectPercent: parseInt(e.target.value, 10) || 0,
                }))
              }
              onBlur={(e) => patchNumber("partsPriceSuspectPercent", e.target.value)}
            />
          </label>

          <div>
            <h2 className="text-sm font-medium text-zinc-200">Facturare</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Cum se înregistrează factura pe comandă după aprobarea devizelor.
            </p>
          </div>

          <fieldset className="space-y-3" disabled={pending}>
            <legend className="sr-only">Mod facturare</legend>
            <label className="flex items-start gap-3 text-sm text-zinc-300">
              <input
                type="radio"
                className="mt-1"
                name="quoteInvoiceMode"
                checked={(settings.quoteInvoiceMode ?? "per_quote") === "per_quote"}
                onChange={() => void patch({ quoteInvoiceMode: "per_quote" })}
              />
              <span>
                <span className="font-medium text-zinc-100">Factură pe fiecare deviz</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Înregistrați factura separat pe Deviz 1, Deviz 2… (implicit).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-zinc-300">
              <input
                type="radio"
                className="mt-1"
                name="quoteInvoiceMode"
                checked={(settings.quoteInvoiceMode ?? "per_quote") === "per_work_order"}
                onChange={() => void patch({ quoteInvoiceMode: "per_work_order" })}
              />
              <span>
                <span className="font-medium text-zinc-100">O factură pe comandă</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Factură din liniile aprobate consolidate (tab Consolidat pe WO).
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      ) : tab === "D" ? (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Pipeline asigurător (daună)</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Adaugă, redenumește, reordonează sau dezactivează pași. Pașii de sistem nu se șterg.
              Final = închide fluxul (ca Accept plată). PDF = cere document pe dosar.
            </p>
          </div>
          <ul className="space-y-3">
            {damageStepsDraft.map((step, idx) => (
              <li
                key={step.code}
                className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      disabled={pending}
                      onChange={(e) => {
                        const next = damageStepsDraft.map((s, i) =>
                          i === idx ? { ...s, enabled: e.target.checked } : s,
                        );
                        setDamageStepsDraft(next);
                      }}
                    />
                    Activ
                  </label>
                  <code className="text-[11px] text-zinc-500">{step.code}</code>
                  {step.system ? (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      sistem
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50"
                      onClick={() =>
                        setDamageStepsDraft(damageStepsDraft.filter((_, i) => i !== idx))
                      }
                    >
                      Șterge
                    </button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      disabled={pending || idx === 0}
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 disabled:opacity-30"
                      onClick={() => {
                        const next = [...damageStepsDraft];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        setDamageStepsDraft(next);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={pending || idx >= damageStepsDraft.length - 1}
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 disabled:opacity-30"
                      onClick={() => {
                        const next = [...damageStepsDraft];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        setDamageStepsDraft(next);
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={step.label}
                  disabled={pending}
                  onChange={(e) => {
                    const next = damageStepsDraft.map((s, i) =>
                      i === idx ? { ...s, label: e.target.value } : s,
                    );
                    setDamageStepsDraft(next);
                  }}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                />
                <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={step.isFinal}
                      disabled={pending}
                      onChange={(e) => {
                        const next = damageStepsDraft.map((s, i) =>
                          i === idx ? { ...s, isFinal: e.target.checked } : s,
                        );
                        setDamageStepsDraft(next);
                      }}
                    />
                    Final
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={step.requiresPdf}
                      disabled={pending}
                      onChange={(e) => {
                        const next = damageStepsDraft.map((s, i) =>
                          i === idx ? { ...s, requiresPdf: e.target.checked } : s,
                        );
                        setDamageStepsDraft(next);
                      }}
                    />
                    Cere PDF
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1 space-y-1 text-sm text-zinc-300">
              <span className="text-xs text-zinc-500">Pas nou</span>
              <input
                type="text"
                value={newStepLabel}
                disabled={pending}
                placeholder="ex. Dosar complementar"
                onChange={(e) => setNewStepLabel(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <button
              type="button"
              disabled={pending || !newStepLabel.trim()}
              onClick={() => {
                const label = newStepLabel.trim();
                let code = newSlug(label);
                const codes = new Set(damageStepsDraft.map((s) => s.code));
                if (codes.has(code)) code = `${code}_${Date.now().toString(36).slice(-4)}`;
                setDamageStepsDraft([
                  ...damageStepsDraft,
                  {
                    code,
                    label,
                    enabled: true,
                    system: false,
                    isFinal: false,
                    requiresPdf: false,
                  },
                ]);
                setNewStepLabel("");
              }}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
            >
              Adaugă pas
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void patch({ damagePipelineSteps: damageStepsDraft })}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Salvează pipeline daună
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const reset = DEFAULT_DAMAGE_PIPELINE_STEPS.map((s) => ({ ...s }));
                setDamageStepsDraft(reset);
                void patch({ damagePipelineSteps: reset });
              }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              Reset la default
            </button>
          </div>
        </div>
      ) : tab === "M" || tab === "E" || tab === "TV" ? (
        <TypeSettingsEditor
          code={tab}
          settings={settings.serviceTypeSettings[tab]}
          pending={pending}
          onSave={(next) => void patch({ serviceTypeSettings: { [tab]: next } as WorkOrderSettings["serviceTypeSettings"] })}
        />
      ) : null}
    </div>
  );
}

function TypeSettingsEditor({
  code,
  settings,
  pending,
  onSave,
}: {
  code: ServiceTypeSettingsKey;
  settings: ServiceTypeSettings;
  pending: boolean;
  onSave: (next: ServiceTypeSettings) => void;
}) {
  const label = SERVICE_ORDER_TYPES.find((t) => t.code === code)?.label ?? code;
  const [draft, setDraft] = useState(settings);
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function setWorkshop(next: WorkshopStatusSetting[]) {
    setDraft((d) => ({ ...d, workshopStatuses: next }));
  }

  return (
    <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-200">
          Tip {code} — {label}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Override pe tip față de setările generale. Garanție goală = moștenește generalul.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={draft.requirePhotosIn}
          disabled={pending}
          onChange={(e) => setDraft((d) => ({ ...d, requirePhotosIn: e.target.checked }))}
        />
        <span>
          <span className="font-medium text-zinc-100">Poze obligatorii la In service</span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={draft.requirePhotosOut}
          disabled={pending}
          onChange={(e) => setDraft((d) => ({ ...d, requirePhotosOut: e.target.checked }))}
        />
        <span>
          <span className="font-medium text-zinc-100">Poze obligatorii la Out service</span>
        </span>
      </label>

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Garanție override</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Lasă gol pentru valorile din Setări generale.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["defaultPartsWarrantyMonths", "Piese (luni)"],
            ["defaultPartsWarrantyKm", "Piese (km)"],
            ["defaultLaborWarrantyMonths", "Manoperă (luni)"],
          ] as const
        ).map(([key, lab]) => (
          <label key={key} className="space-y-1 text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{lab}</span>
            <input
              type="number"
              min={0}
              placeholder="—"
              disabled={pending}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={draft[key] ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setDraft((d) => ({
                  ...d,
                  [key]: v === "" ? null : parseInt(v, 10) || 0,
                }));
              }}
            />
          </label>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Statusuri atelier</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          {code === "TV"
            ? "Pași atelier tipici TV — editabile, reordonabile."
            : "Opțional pentru acest tip (checklist / etape interne)."}
        </p>
      </div>
      <ul className="space-y-2">
        {draft.workshopStatuses.map((st, idx) => (
          <li
            key={st.code}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 p-2"
          >
            <input
              type="checkbox"
              checked={st.enabled}
              disabled={pending}
              onChange={(e) => {
                const next = draft.workshopStatuses.map((s, i) =>
                  i === idx ? { ...s, enabled: e.target.checked } : s,
                );
                setWorkshop(next);
              }}
            />
            <code className="text-[11px] text-zinc-500">{st.code}</code>
            <input
              type="text"
              value={st.label}
              disabled={pending}
              onChange={(e) => {
                const next = draft.workshopStatuses.map((s, i) =>
                  i === idx ? { ...s, label: e.target.value } : s,
                );
                setWorkshop(next);
              }}
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
            <button
              type="button"
              disabled={pending || idx === 0}
              className="rounded border border-zinc-700 px-1.5 text-[11px] disabled:opacity-30"
              onClick={() => {
                const next = [...draft.workshopStatuses];
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                setWorkshop(next);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={pending || idx >= draft.workshopStatuses.length - 1}
              className="rounded border border-zinc-700 px-1.5 text-[11px] disabled:opacity-30"
              onClick={() => {
                const next = [...draft.workshopStatuses];
                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                setWorkshop(next);
              }}
            >
              ↓
            </button>
            <button
              type="button"
              disabled={pending}
              className="text-[11px] text-red-400"
              onClick={() => setWorkshop(draft.workshopStatuses.filter((_, i) => i !== idx))}
            >
              Șterge
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newStatus}
          disabled={pending}
          placeholder="Status nou"
          onChange={(e) => setNewStatus(e.target.value)}
          className="min-w-[10rem] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
        />
        <button
          type="button"
          disabled={pending || !newStatus.trim()}
          onClick={() => {
            const labelText = newStatus.trim();
            let codeSlug = newSlug(labelText);
            const codes = new Set(draft.workshopStatuses.map((s) => s.code));
            if (codes.has(codeSlug)) codeSlug = `${codeSlug}_${Date.now().toString(36).slice(-4)}`;
            setWorkshop([
              ...draft.workshopStatuses,
              { code: codeSlug, label: labelText, enabled: true },
            ]);
            setNewStatus("");
          }}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
        >
          Adaugă
        </button>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => onSave(draft)}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Salvează tip {code}
      </button>
    </div>
  );
}
