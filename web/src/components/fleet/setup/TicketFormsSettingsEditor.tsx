"use client";

import { useCallback, useEffect, useState } from "react";
import { AppointmentPolicyFields } from "@/components/fleet/setup/AppointmentPolicyFields";
import { clientsBrowserBase, type ClientListPayload } from "@/lib/clients-api";
import {
  DEFAULT_CLIENT_IAM_SETTINGS,
  type ClientIamSettings,
} from "@/lib/client-iam-settings";
import { fleetJsonHeaders } from "@/lib/fleet-api";

export function TicketFormsSettingsEditor() {
  const [clients, setClients] = useState<Array<{ id: string; code: string; legalName: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [draft, setDraft] = useState<ClientIamSettings>(DEFAULT_CLIENT_IAM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${clientsBrowserBase}?status=active&pageSize=200`, {
          headers: fleetJsonHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ClientListPayload;
        if (cancelled) return;
        const items = data.items.map((c) => ({
          id: c.id,
          code: c.code,
          legalName: c.legalName,
        }));
        setClients(items);
        setClientId((current) => current || items[0]?.id || "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Nu s-au putut încărca clienții.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSettings = useCallback(async (id: string) => {
    if (!id) return;
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${clientsBrowserBase}/${id}/iam-settings`, {
        headers: fleetJsonHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ClientIamSettings;
      setDraft({
        allowClientOcr: data.allowClientOcr === true,
        allowClientAcquisition: data.allowClientAcquisition === true,
        requireDriverAck: data.requireDriverAck !== false,
        driverCanNegotiateAppointment: data.driverCanNegotiateAppointment === true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
    }
  }, []);

  useEffect(() => {
    if (clientId) void loadSettings(clientId);
  }, [clientId, loadSettings]);

  async function save() {
    if (!clientId) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/iam-settings`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          requireDriverAck: draft.requireDriverAck,
          driverCanNegotiateAppointment: draft.driverCanNegotiateAppointment,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as ClientIamSettings;
      setDraft((d) => ({
        ...d,
        requireDriverAck: next.requireDriverAck !== false,
        driverCanNegotiateAppointment: next.driverCanNegotiateAppointment === true,
      }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-lg font-medium text-zinc-100">Formulare tichet</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Politica de confirmare a programării pe client: cine decide data și dacă șoferul mai
          confirmă după manager.
        </p>
      </div>

      <label className="block text-sm text-zinc-300">
        Client
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={loading || pending}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 disabled:opacity-60"
        >
          {loading ? <option value="">Se încarcă…</option> : null}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.legalName}
            </option>
          ))}
        </select>
      </label>

      {clientId ? (
        <AppointmentPolicyFields
          draft={draft}
          onChange={setDraft}
          disabled={pending || loading}
        />
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-300">Salvat.</p> : null}

      <button
        type="button"
        disabled={pending || !clientId}
        onClick={() => void save()}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Salvez…" : "Salvează politica"}
      </button>
    </div>
  );
}
