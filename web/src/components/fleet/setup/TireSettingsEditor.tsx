"use client";

import Link from "next/link";
import { useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_TIRE_SETTINGS,
  tireSettingsBrowserBase,
  type TireSettings,
} from "@/lib/tire-settings";

type Props = {
  initial: TireSettings;
};

export function TireSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState<TireSettings>(initial ?? DEFAULT_TIRE_SETTINGS);
  const [webhookSecretDraft, setWebhookSecretDraft] = useState("");
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      const body: Record<string, unknown> = {
        hotelMinBillableMonths: settings.hotelMinBillableMonths,
        hotelTicketHidesServiceFlow: settings.hotelTicketHidesServiceFlow,
        seasonalSwapEnabled: settings.seasonalSwapEnabled,
        hotelBillingUnit: "piece",
        hotelBillingPeriod: "calendar_month",
        webhookUrl: settings.webhookUrl?.trim() || null,
      };
      if (clearWebhookSecret) body.webhookSecret = null;
      else if (webhookSecretDraft.trim()) body.webhookSecret = webhookSecretDraft.trim();
      const res = await fetch(tireSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as TireSettings;
      setSettings(next);
      setWebhookSecretDraft("");
      setClearWebhookSecret(false);
      setInfo("Setările anvelope au fost salvate.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Tarif hotel (model comercial)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            În viața reală, furnizorii cotează <strong className="font-medium text-zinc-400">pe bucată</strong>,{" "}
            <strong className="font-medium text-zinc-400">pe lună calendaristică</strong>, pe dimensiune /
            jantă, diferențiat <em>doar anvelopă</em> vs <em>roată (jantă+anvelopă)</em>. Totalul pe sejur =
            bucăți × tarif lunar × luni.
          </p>
        </div>
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <dt className="text-zinc-500">Unitate de listă</dt>
            <dd className="mt-0.5 text-zinc-200">Bucată anvelopă (nu set, nu sejur)</dd>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <dt className="text-zinc-500">Perioadă</dt>
            <dd className="mt-0.5 text-zinc-200">Lună calendaristică</dd>
          </div>
        </dl>
        <label className="block text-xs text-zinc-500">
          Luni minime facturate la check-in / sejur deschis
          <input
            type="number"
            min={1}
            max={24}
            value={settings.hotelMinBillableMonths}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                hotelMinBillableMonths: Math.min(24, Math.max(1, Number(e.target.value) || 1)),
              }))
            }
            className="mt-1 block w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
          />
        </label>
        <p className="text-[11px] text-zinc-600">
          Tarifele concrete (RON/buc/lună pe benzi jantă) se setează pe{" "}
          <Link href="/fleet/suppliers" className="text-zinc-400 underline-offset-2 hover:underline">
            fișa furnizorului
          </Link>{" "}
          și pot fi overlay pe alocarea client ↔ furnizor.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Flux operațional (default)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Lucrăm pe <strong className="font-medium text-zinc-400">seturi</strong>. Hotelul e mutare de
            custody pe set; tichetul/WO spun doar de ce.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={settings.hotelTicketHidesServiceFlow}
            onChange={(e) =>
              setSettings((s) => ({ ...s, hotelTicketHidesServiceFlow: e.target.checked }))
            }
            className="mt-1 rounded border-zinc-600 bg-zinc-900"
          />
          <span>
            Pe tichet tip <span className="font-mono text-xs text-zinc-400">Hotel anvelope</span>, panelul
            hotel e drumul principal (flux service atelier coborât).
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={settings.seasonalSwapEnabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, seasonalSwapEnabled: e.target.checked }))
            }
            className="mt-1 rounded border-zinc-600 bg-zinc-900"
          />
          <span>
            Pe WO anvelope: bloc schimb sezon — setul care iese (cazare) + setul care intră (din hotel
            sau nou).
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Webhook sejur hotel</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Notificări outbound la check-in / check-out.{" "}
            <code className="text-zinc-400">WEBHOOK_TIRE_URL</code> din mediu are prioritate dacă e
            setat. Secretul e doar la scriere (HMAC{" "}
            <code className="text-zinc-400">X-Tire-Signature</code>).
          </p>
        </div>
        <label className="block text-xs text-zinc-500">
          URL webhook
          <input
            value={settings.webhookUrl ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, webhookUrl: e.target.value }))}
            placeholder="https://…"
            className="mt-1 block w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Secret HMAC {settings.webhookSecretConfigured ? "(configurat — lasă gol ca să păstrezi)" : ""}
          <input
            type="password"
            autoComplete="new-password"
            value={webhookSecretDraft}
            onChange={(e) => {
              setWebhookSecretDraft(e.target.value);
              if (e.target.value.trim()) setClearWebhookSecret(false);
            }}
            disabled={clearWebhookSecret}
            placeholder={settings.webhookSecretConfigured ? "••••••••" : "opțional"}
            className="mt-1 block w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 disabled:opacity-50"
          />
        </label>
        {settings.webhookSecretConfigured ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={clearWebhookSecret}
              onChange={(e) => {
                setClearWebhookSecret(e.target.checked);
                if (e.target.checked) setWebhookSecretDraft("");
              }}
              className="rounded border-zinc-600 bg-zinc-900"
            />
            Șterge secretul salvat
          </label>
        ) : null}
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-400/90">{info}</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Se salvează…" : "Salvează"}
      </button>
    </div>
  );
}
