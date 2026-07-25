"use client";

import { useCallback, useEffect, useState } from "react";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import type { ServiceCaseRecord } from "@/lib/service-cases-api";
import {
  ROADSIDE_KINDS,
  ROADSIDE_STATUSES,
  fleetJsonHeaders,
  isRoadsideActive,
  roadsideBrowserBase,
  roadsideKindLabel,
  roadsideStatusLabel,
  type RoadsideInterventionKind,
  type RoadsideInterventionRecord,
  type RoadsideInterventionStatus,
} from "@/lib/roadside-api";

type Props = {
  serviceCase: ServiceCaseRecord | null | undefined;
  ticketId: string;
  canWrite: boolean;
};

export function RoadsideAssistancePanel({ serviceCase, ticketId, canWrite }: Props) {
  const [items, setItems] = useState<RoadsideInterventionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState<RoadsideInterventionKind>("tow");
  const [status, setStatus] = useState<RoadsideInterventionStatus>("requested");
  const [supplierId, setSupplierId] = useState("");
  const [locationText, setLocationText] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "50");
      if (serviceCase?.id) params.set("serviceCaseId", serviceCase.id);
      else params.set("ticketId", ticketId);
      const res = await fetch(`${roadsideBrowserBase}/interventions?${params}`);
      if (!res.ok) {
        setItems([]);
        return;
      }
      const j = (await res.json()) as { items?: RoadsideInterventionRecord[] };
      setItems(j.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [serviceCase?.id, ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const immovableHint =
    serviceCase?.vehicleMovable === "immovable" ||
    items.some((i) => i.status === "draft" && i.kind === "tow");

  async function createIntervention() {
    if (!serviceCase?.id) {
      setError("Deschide mai întâi fluxul service ca să poți înregistra asistența rutieră.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${roadsideBrowserBase}/interventions`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          serviceCaseId: serviceCase.id,
          ticketId,
          kind,
          status,
          supplierId: supplierId || null,
          locationText: locationText.trim() || null,
          notes: notes.trim() || null,
          workOrderId: serviceCase.workOrders[0]?.id ?? null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      setLocationText("");
      setNotes("");
      setSupplierId("");
      setKind("tow");
      setStatus("requested");
      await load();
    } finally {
      setPending(false);
    }
  }

  async function patchStatus(id: string, next: RoadsideInterventionStatus) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${roadsideBrowserBase}/interventions/${id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  const activeCount = items.filter((i) => isRoadsideActive(i.status)).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-100">Asistență rutieră</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Modul opțional pe același tichet — nu e comandă service separată. Tractarea e un tip de
          intervenție.
          {activeCount > 0 ? ` · ${activeCount} intervenție(i) active/finalizate.` : null}
        </p>
      </div>

      {immovableHint ? (
        <div className="rounded-lg border border-sky-500/40 bg-sky-950/20 px-3 py-2 text-sm text-sky-100">
          Vehicul nedeplasabil — completează / activează intervenția (draft → solicitată) înainte de In
          service.
        </div>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg border px-3 py-2 ${
                isRoadsideActive(item.status)
                  ? "border-emerald-500/35 bg-emerald-950/15"
                  : "border-zinc-800 bg-zinc-950/40"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-zinc-100">
                    <span className="font-mono text-xs text-zinc-400">
                      {item.displayNumber ?? "—"}
                    </span>
                    {" · "}
                    {roadsideKindLabel(item.kind)}
                    {" · "}
                    <span className="text-zinc-300">{roadsideStatusLabel(item.status)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {item.supplierLegalName ?? "Fără furnizor"}
                    {item.locationText ? ` · ${item.locationText}` : ""}
                    {item.vehicleReg ? ` · ${item.vehicleReg}` : ""}
                  </p>
                  {item.notes ? <p className="mt-1 text-xs text-zinc-400">{item.notes}</p> : null}
                </div>
                {canWrite && item.status !== "completed" && item.status !== "cancelled" ? (
                  <div className="flex flex-wrap gap-1">
                    {item.status === "requested" || item.status === "draft" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                        onClick={() => void patchStatus(item.id, "dispatched")}
                      >
                        Dispecerizează
                      </button>
                    ) : null}
                    {item.status === "dispatched" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                        onClick={() => void patchStatus(item.id, "on_site")}
                      >
                        Pe loc
                      </button>
                    ) : null}
                    {item.status === "on_site" || item.status === "dispatched" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border border-emerald-700/50 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-950/40"
                        onClick={() => void patchStatus(item.id, "completed")}
                      >
                        Finalizează
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-900"
                      onClick={() => void patchStatus(item.id, "cancelled")}
                    >
                      Anulează
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="text-sm text-zinc-500">Nicio intervenție încă — opțional pe acest dosar.</p>
      ) : null}

      {canWrite ? (
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Intervenție nouă
          </p>
          {!serviceCase ? (
            <p className="text-sm text-amber-200/90">
              Deschide fluxul service din tab-ul Flux operațional, apoi revino aici.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={OPS_LABEL_CLASS}>Tip</span>
                  <select
                    className={OPS_INPUT_CLASS}
                    disabled={pending}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as RoadsideInterventionKind)}
                  >
                    {ROADSIDE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {roadsideKindLabel(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={OPS_LABEL_CLASS}>Status</span>
                  <select
                    className={OPS_INPUT_CLASS}
                    disabled={pending}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RoadsideInterventionStatus)}
                  >
                    {ROADSIDE_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                      <option key={s} value={s}>
                        {roadsideStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <span className={OPS_LABEL_CLASS}>Furnizor asistență</span>
                <SupplierCombobox
                  value={supplierId}
                  category="roadside_assistance"
                  onChange={(id) => setSupplierId(id)}
                  disabled={pending}
                />
              </div>
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Locație</span>
                <input
                  className={OPS_INPUT_CLASS}
                  disabled={pending}
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Adresă / km / punct de pe traseu"
                />
              </label>
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Note</span>
                <textarea
                  className={OPS_INPUT_CLASS}
                  rows={2}
                  disabled={pending}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() => void createIntervention()}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                Adaugă intervenție
              </button>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
