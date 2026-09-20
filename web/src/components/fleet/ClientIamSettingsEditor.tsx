"use client";

import { useCallback, useEffect, useState } from "react";
import { AppointmentPolicyFields } from "@/components/fleet/setup/AppointmentPolicyFields";
import { clientsBrowserBase } from "@/lib/clients-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_CLIENT_IAM_SETTINGS,
  type ClientIamSettings,
} from "@/lib/client-iam-settings";

type Props = {
  clientId: string;
  canWrite: boolean;
};

export function ClientIamSettingsEditor({ clientId, canWrite }: Props) {
  const [draft, setDraft] = useState<ClientIamSettings>(DEFAULT_CLIENT_IAM_SETTINGS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/iam-settings`, {
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
      const res = await fetch(`${clientsBrowserBase}/${clientId}/iam-settings`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as ClientIamSettings;
      setDraft({
        allowClientOcr: next.allowClientOcr === true,
        allowClientAcquisition: next.allowClientAcquisition === true,
        requireDriverAck: next.requireDriverAck !== false,
        driverCanNegotiateAppointment: next.driverCanNegotiateAppointment === true,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-zinc-400">
        Drepturi pentru managerul acestui client (L1). Default oprit — le aprinde adminul
        abonatului. Adminul abonatului (L*) le are oricum.
      </p>
      <label className="flex items-start gap-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={draft.allowClientOcr}
          disabled={!canWrite || pending}
          onChange={(e) => setDraft((d) => ({ ...d, allowClientOcr: e.target.checked }))}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">OCR CIV</span>
          <span className="block text-xs text-zinc-500">
            L1 poate extrage și salva date din scanul CIV pe vehiculele clientului.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={draft.allowClientAcquisition}
          disabled={!canWrite || pending}
          onChange={(e) => setDraft((d) => ({ ...d, allowClientAcquisition: e.target.checked }))}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Date achiziție</span>
          <span className="block text-xs text-zinc-500">
            L1 vede și editează tab-ul Date achiziție (preț, leasing, contract).
          </span>
        </span>
      </label>
      <div className="border-t border-zinc-800 pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Programare service
        </p>
        <AppointmentPolicyFields
          draft={draft}
          onChange={setDraft}
          disabled={!canWrite || pending}
        />
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-300">Salvat.</p> : null}
      {canWrite ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending ? "Salvez…" : "Salvează drepturile"}
        </button>
      ) : (
        <p className="text-xs text-zinc-500">Doar adminul abonatului poate schimba aceste bife.</p>
      )}
    </div>
  );
}
