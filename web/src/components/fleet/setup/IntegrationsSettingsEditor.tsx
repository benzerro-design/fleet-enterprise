"use client";

import { useMemo, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_TENANT_INTEGRATIONS_SETTINGS,
  integrationsSettingsBrowserBase,
  type InterCarsApiMode,
  type InterCarsEnvironment,
  type TenantIntegrationsSettings,
} from "@/lib/integrations-settings";

type Props = {
  initial: TenantIntegrationsSettings;
};

type InterCarsDraft = {
  mode: InterCarsApiMode;
  environment: InterCarsEnvironment;
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  customerCode: string;
  apiToken: string;
  allowStubFallback: boolean;
};

function toDraft(s: TenantIntegrationsSettings): InterCarsDraft {
  const ic = s.interCars ?? DEFAULT_TENANT_INTEGRATIONS_SETTINGS.interCars;
  return {
    mode: ic.mode,
    environment: ic.environment,
    baseUrl: ic.baseUrl ?? "",
    tokenUrl: ic.tokenUrl ?? "",
    clientId: ic.clientId ?? "",
    clientSecret: "",
    accessToken: "",
    customerCode: ic.customerCode ?? "",
    apiToken: "",
    allowStubFallback: ic.allowStubFallback,
  };
}

export function IntegrationsSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [icDraft, setIcDraft] = useState(() => toDraft(initial));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const ic = settings.interCars ?? DEFAULT_TENANT_INTEGRATIONS_SETTINGS.interCars;

  async function patch(partial: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(integrationsSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as TenantIntegrationsSettings;
      setSettings(next);
      setIcDraft(toDraft(next));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  function toggleProvider(id: string, enabled: boolean) {
    const nextProviders = settings.partsCatalogProviders.map((p) =>
      p.id === id ? { ...p, enabled } : p,
    );
    void patch({ partsCatalogProviders: nextProviders });
  }

  async function saveInterCars() {
    const body: Record<string, unknown> = {
      mode: icDraft.mode,
      environment: icDraft.environment,
      baseUrl: icDraft.baseUrl.trim() || null,
      tokenUrl: icDraft.tokenUrl.trim() || null,
      clientId: icDraft.clientId.trim() || null,
      customerCode: icDraft.customerCode.trim() || null,
      allowStubFallback: icDraft.allowStubFallback,
    };
    if (icDraft.clientSecret.trim()) body.clientSecret = icDraft.clientSecret.trim();
    if (icDraft.accessToken.trim()) body.accessToken = icDraft.accessToken.trim();
    if (icDraft.apiToken.trim()) body.apiToken = icDraft.apiToken.trim();
    await patch({ interCars: body });
  }

  async function testInterCars() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${integrationsSettingsBrowserBase}/intercars/test`, {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as TenantIntegrationsSettings;
      setSettings(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test eșuat");
    } finally {
      setPending(false);
    }
  }

  const testTone = useMemo(() => {
    if (ic.lastTestOk === true) return "text-emerald-400";
    if (ic.lastTestOk === false) return "text-red-400";
    return "text-zinc-500";
  }, [ic.lastTestOk]);

  return (
    <div className="max-w-2xl space-y-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Import deviz</h2>
          <p className="mt-1 text-xs text-zinc-500">
            PDF / scan Audatex → preview linii → ciornă pe comandă. Necesită și „Import PDF” în Setup → WO.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.audatexImportEnabled}
            disabled={pending}
            onChange={(e) => void patch({ audatexImportEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Import PDF / Audatex</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Activează OCR + mapare pe WO → Comandă → Import deviz PDF.
            </span>
          </span>
        </label>

        <div className="border-t border-zinc-800 pt-5">
          <h2 className="text-sm font-medium text-zinc-200">Catalog piese</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Lookup / „Verifică preț”. Cu credențiale Inter Cars → oferte reale; altfel stub (dacă e permis).
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.partsCatalogEnabled}
            disabled={pending}
            onChange={(e) => void patch({ partsCatalogEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Catalog piese activ</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Activează și un provider mai jos (Inter Cars).
            </span>
          </span>
        </label>

        <ul className="space-y-2 pl-1">
          {settings.partsCatalogProviders.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  disabled={pending || !settings.partsCatalogEnabled}
                  onChange={(e) => toggleProvider(p.id, e.target.checked)}
                />
                <span>
                  {p.label}
                  <span className="ml-2 text-xs text-zinc-500">({p.id})</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">Inter Cars — credențiale</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Gateway IC REST (recomandat) sau Katalog External (kh_kod + token). Secret-urile nu sunt reafișate după salvare.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-400">
              Mod API
              <select
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                value={icDraft.mode}
                disabled={pending}
                onChange={(e) =>
                  setIcDraft((d) => ({ ...d, mode: e.target.value as InterCarsApiMode }))
                }
              >
                <option value="gateway">Gateway IC REST</option>
                <option value="katalog_legacy">Katalog External (legacy)</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-zinc-400">
              Mediu
              <select
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                value={icDraft.environment}
                disabled={pending}
                onChange={(e) =>
                  setIcDraft((d) => ({
                    ...d,
                    environment: e.target.value as InterCarsEnvironment,
                  }))
                }
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>
          </div>

          {icDraft.mode === "gateway" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-zinc-400 sm:col-span-2">
                Base URL (opțional)
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                  placeholder="https://dev.gw.intercars.eu"
                  value={icDraft.baseUrl}
                  disabled={pending}
                  onChange={(e) => setIcDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-400 sm:col-span-2">
                Token URL (opțional)
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                  placeholder="…/token"
                  value={icDraft.tokenUrl}
                  disabled={pending}
                  onChange={(e) => setIcDraft((d) => ({ ...d, tokenUrl: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-400">
                Client ID
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                  value={icDraft.clientId}
                  disabled={pending}
                  onChange={(e) => setIcDraft((d) => ({ ...d, clientId: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-400">
                Client secret {ic.clientSecretSet ? "(setat)" : ""}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                  placeholder={ic.clientSecretSet ? "••••••••" : ""}
                  value={icDraft.clientSecret}
                  disabled={pending}
                  onChange={(e) => setIcDraft((d) => ({ ...d, clientSecret: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-400 sm:col-span-2">
                Access token (opțional, alternativă) {ic.accessTokenSet ? "(setat)" : ""}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                  placeholder={ic.accessTokenSet ? "••••••••" : "Bearer token"}
                  value={icDraft.accessToken}
                  disabled={pending}
                  onChange={(e) => setIcDraft((d) => ({ ...d, accessToken: e.target.value }))}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-zinc-400">
                Customer code (kh_kod)
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                  value={icDraft.customerCode}
                  disabled={pending}
                  onChange={(e) => setIcDraft((d) => ({ ...d, customerCode: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-400">
                API token {ic.apiTokenSet ? "(setat)" : ""}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100"
                  placeholder={ic.apiTokenSet ? "••••••••" : ""}
                  value={icDraft.apiToken}
                  disabled={pending}
                  onChange={(e) => setIcDraft((d) => ({ ...d, apiToken: e.target.value }))}
                />
              </label>
              <p className="sm:col-span-2 text-xs text-amber-200/80">
                Modul legacy autentifică pe Katalog; quote de preț e pe Gateway — folosește Gateway pentru „Verifică preț” real.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={icDraft.allowStubFallback}
              disabled={pending}
              onChange={(e) => setIcDraft((d) => ({ ...d, allowStubFallback: e.target.checked }))}
            />
            <span>
              <span className="font-medium text-zinc-100">Fallback stub</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Dacă API lipsește/eșuează, folosește prețuri sintetice (ca înainte).
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void saveInterCars()}
              className="rounded border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
            >
              Salvează Inter Cars
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void testInterCars()}
              className="rounded border border-sky-600/50 bg-sky-950/40 px-3 py-1.5 text-xs font-semibold text-sky-100 disabled:opacity-50"
            >
              Test conexiune
            </button>
          </div>

          {ic.lastTestAt ? (
            <p className={`text-xs ${testTone}`}>
              Ultimul test: {new Date(ic.lastTestAt).toLocaleString("ro-RO")} —{" "}
              {ic.lastTestMessage ?? (ic.lastTestOk ? "OK" : "eșuat")}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">Niciun test rulat încă.</p>
          )}
        </div>

        <div className="border-t border-zinc-800 pt-5">
          <h2 className="text-sm font-medium text-zinc-200">Comenzi piese</h2>
          <p className="mt-1 text-xs text-zinc-500">
            După Deviz aprobat: buton lansare + status pe linii (ordered / in_stock / delivered).
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.partsOrderLaunchEnabled}
            disabled={pending}
            onChange={(e) => void patch({ partsOrderLaunchEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Lansare comenzi piese</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Activează lansarea din WO (necesită și Setup → WO). Canal Inter Cars dacă există credențiale.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
