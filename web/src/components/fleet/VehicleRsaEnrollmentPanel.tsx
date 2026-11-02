"use client";

import { useCallback, useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import {
  createRsaEnrollment,
  loadRsaEnrollments,
  loadRsaPlans,
  patchRsaEnrollment,
  rsaEnrollmentStatusLabel,
  type RsaEnrollmentRecord,
  type RsaEnrollmentStatus,
  type RsaPlanRecord,
} from "@/lib/roadside-api";

type Props = {
  vehicleId: string;
  canWrite: boolean;
};

export function VehicleRsaEnrollmentPanel({ vehicleId, canWrite }: Props) {
  const [items, setItems] = useState<RsaEnrollmentRecord[]>([]);
  const [plans, setPlans] = useState<RsaPlanRecord[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [planId, setPlanId] = useState("");
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [extNo, setExtNo] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadRsaEnrollments({ vehicleId, pageSize: 50 });
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare înrolări");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supplierId) {
      setPlans([]);
      setPlanId("");
      return;
    }
    let cancelled = false;
    void loadRsaPlans(supplierId)
      .then((list) => {
        if (cancelled) return;
        const active = list.filter((p) => p.active);
        setPlans(active);
        setPlanId((prev) => (active.some((p) => p.id === prev) ? prev : active[0]?.id ?? ""));
      })
      .catch(() => {
        if (!cancelled) {
          setPlans([]);
          setPlanId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  async function onCreate() {
    if (!canWrite || !planId) return;
    setPending(true);
    setError(null);
    try {
      await createRsaEnrollment({
        vehicleId,
        planId,
        validFrom,
        validUntil: validUntil || null,
        externalSubscriptionNo: extNo || null,
        notes: notes || null,
      });
      setExtNo("");
      setNotes("");
      setValidUntil("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creare înrolare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function setStatus(id: string, status: RsaEnrollmentStatus) {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    try {
      await patchRsaEnrollment(id, { status });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Actualizare eșuată");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Se încarcă înrolările RSA…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">Asistență rutieră — înrolare</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Abonament pe plan RSA (furnizor asistență). Fără înrolare, intervențiile rămân pay-per-use.
        </p>
      </div>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nicio înrolare pe acest vehicul.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
              <div>
                <div className="text-zinc-200">
                  {e.planName}{" "}
                  <span className="font-mono text-xs text-zinc-500">({e.planCode})</span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {e.supplierLegalName} · {rsaEnrollmentStatusLabel(e.status)} · {e.validFrom}
                  {e.validUntil ? ` → ${e.validUntil}` : " → ∞"}
                  {e.externalSubscriptionNo ? ` · #${e.externalSubscriptionNo}` : ""}
                </div>
              </div>
              {canWrite && e.status === "active" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void setStatus(e.id, "cancelled")}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900"
                >
                  Anulează
                </button>
              ) : null}
              {canWrite && e.status === "suspended" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void setStatus(e.id, "active")}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-emerald-400 hover:bg-zinc-900"
                >
                  Reactivează
                </button>
              ) : null}
              {canWrite && e.status === "active" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void setStatus(e.id, "suspended")}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-amber-400 hover:bg-zinc-900"
                >
                  Suspendă
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Înrolare nouă
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <span className={OPS_LABEL_CLASS}>Furnizor RSA</span>
              <SupplierCombobox
                value={supplierId}
                category="roadside_assistance"
                onChange={(id) => setSupplierId(id)}
                disabled={pending}
              />
            </div>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Plan</span>
              <select
                className={OPS_INPUT_CLASS}
                disabled={pending || !plans.length}
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {!plans.length ? <option value="">— alegeți furnizorul —</option> : null}
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Valid de la</span>
              <input
                type="date"
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Valid până (opțional)</span>
              <input
                type="date"
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Nr. abonament extern</span>
              <input
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={extNo}
                onChange={(e) => setExtNo(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Note</span>
              <input
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={pending || !planId || !validFrom}
            onClick={() => void onCreate()}
            className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Înrolează vehiculul
          </button>
        </div>
      ) : null}
    </div>
  );
}
