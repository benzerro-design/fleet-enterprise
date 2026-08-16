"use client";

import { useCallback, useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { clientsBrowserBase } from "@/lib/clients-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_CLIENT_PRICING_SETTINGS,
  type ClientPricingSettings,
} from "@/lib/client-pricing-settings";

type Props = {
  clientId: string;
  canWrite: boolean;
};

export function ClientPricingSettingsEditor({ clientId, canWrite }: Props) {
  const [settings, setSettings] = useState<ClientPricingSettings>(DEFAULT_CLIENT_PRICING_SETTINGS);
  const [draft, setDraft] = useState<ClientPricingSettings>(DEFAULT_CLIENT_PRICING_SETTINGS);
  const [overrideOn, setOverrideOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/pricing-settings`, {
        headers: fleetJsonHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ClientPricingSettings;
      const next = {
        partsPriceSuspectPercent:
          data.partsPriceSuspectPercent == null ? null : data.partsPriceSuspectPercent,
      };
      setSettings(next);
      setDraft(next);
      setOverrideOn(next.partsPriceSuspectPercent != null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const payload: ClientPricingSettings = {
        partsPriceSuspectPercent: overrideOn
          ? Math.max(0, Math.round(draft.partsPriceSuspectPercent ?? 25))
          : null,
      };
      const res = await fetch(`${clientsBrowserBase}/${clientId}/pricing-settings`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as ClientPricingSettings;
      setSettings(next);
      setDraft(next);
      setOverrideOn(next.partsPriceSuspectPercent != null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Prag preț suspect (catalog)</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Override opțional pe acest client. Gol / dezactivat = valoarea din Setup → Work orders.
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={overrideOn}
          disabled={!canWrite || pending}
          onChange={(e) => {
            setOverrideOn(e.target.checked);
            if (e.target.checked && draft.partsPriceSuspectPercent == null) {
              setDraft({ partsPriceSuspectPercent: 25 });
            }
          }}
        />
        <span>
          <span className="font-medium text-zinc-100">Override prag pe client</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Acum:{" "}
            {settings.partsPriceSuspectPercent != null
              ? `${settings.partsPriceSuspectPercent}% (client)`
              : "moștenește tenant"}
          </span>
        </span>
      </label>

      {overrideOn ? (
        <label className="block space-y-1">
          <span className={OPS_LABEL_CLASS}>Prag suspect (%)</span>
          <input
            type="number"
            min={0}
            max={500}
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={draft.partsPriceSuspectPercent ?? 25}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              setDraft({
                partsPriceSuspectPercent: Number.isFinite(n) ? Math.max(0, n) : 0,
              });
            }}
          />
        </label>
      ) : null}

      {canWrite ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
        >
          {pending ? "Se salvează…" : "Salvează"}
        </button>
      ) : null}
    </div>
  );
}
