"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import {
  SERVICE_CASE_STAGES,
  serviceCaseStageLabel,
  serviceCasesBrowserBase,
  fleetJsonHeaders,
  type ServiceCaseRecord,
  type ServiceCaseStage,
} from "@/lib/service-cases-api";

type Props = {
  ticketId: string;
  canWrite: boolean;
  closed: boolean;
  hasVehicle: boolean;
};

export function TicketWorkflowStepper({ ticketId, canWrite, closed, hasVehicle }: Props) {
  const router = useRouter();
  const [serviceCase, setServiceCase] = useState<ServiceCaseRecord | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/by-ticket/${ticketId}`);
      if (res.status === 404) {
        setServiceCase(null);
        return;
      }
      if (!res.ok) {
        setServiceCase(null);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord | null;
      setServiceCase(data);
      if (data?.supplierId) setSupplierId(data.supplierId);
    } catch {
      setServiceCase(null);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCase() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/from-ticket/${ticketId}`, {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function advance(targetStage?: ServiceCaseStage) {
    if (!serviceCase) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${serviceCase.id}/advance`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          targetStage,
          supplierId: supplierId || null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as ServiceCaseRecord;
      setServiceCase(data);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (serviceCase === undefined) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm text-zinc-500">Se încarcă fluxul operațional…</p>
      </section>
    );
  }

  const currentIdx = serviceCase
    ? SERVICE_CASE_STAGES.indexOf(serviceCase.currentStage)
    : -1;
  const nextStage =
    serviceCase && currentIdx >= 0 && currentIdx < SERVICE_CASE_STAGES.length - 1
      ? SERVICE_CASE_STAGES[currentIdx + 1]
      : null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-medium text-zinc-200">Flux operațional</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Tichet → programare → comandă service → deviz → aprobare → cost → factură → închidere
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      {!serviceCase ? (
        <div className="mt-4">
          {!hasVehicle ? (
            <p className="text-sm text-amber-300">Atașează un vehicul la tichet pentru a porni fluxul.</p>
          ) : canWrite && !closed ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void startCase()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Pornește dosar lucrare
            </button>
          ) : (
            <p className="text-sm text-zinc-500">Dosarul nu a fost pornit.</p>
          )}
        </div>
      ) : (
        <>
          <ol className="mt-4 flex flex-wrap gap-2">
            {SERVICE_CASE_STAGES.map((stage, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <li
                  key={stage}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    active
                      ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200"
                      : done
                        ? "border-zinc-600 bg-zinc-800/60 text-zinc-300"
                        : "border-zinc-800 text-zinc-500"
                  }`}
                >
                  {serviceCaseStageLabel(stage)}
                </li>
              );
            })}
          </ol>

          {serviceCase.workOrders.length > 0 ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
              <p className="text-xs uppercase text-zinc-500">Comenzi service</p>
              <ul className="mt-2 space-y-1">
                {serviceCase.workOrders.map((wo) => (
                  <li key={wo.id} className="text-zinc-300">
                    {wo.title} — {wo.status}
                    {wo.supplierLegalName ? ` · ${wo.supplierLegalName}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canWrite && !closed && serviceCase.status === "active" && nextStage ? (
            <div className="mt-4 space-y-3">
              {nextStage === "work_order" || serviceCase.currentStage === "scheduled" ? (
                <div>
                  <label className="text-xs text-zinc-500">Furnizor / service</label>
                  <div className="mt-1">
                    <SupplierCombobox
                      value={supplierId}
                      onChange={(id) => setSupplierId(id)}
                      category={serviceCase.workflowType === "itp" ? "itp" : "service_auto"}
                    />
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => void advance()}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                Avansează la: {serviceCaseStageLabel(nextStage)}
              </button>
            </div>
          ) : null}

          {serviceCase.status === "completed" ? (
            <p className="mt-3 text-sm text-emerald-400">Dosar închis.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
