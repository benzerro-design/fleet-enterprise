"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  OPS_INPUT_CLASS,
  OpsFormField,
  OpsFormSection,
  OpsFormStickyActions,
} from "@/components/fleet/ops-form-primitives";
import { SupplierCombobox } from "@/components/fleet/SupplierCombobox";
import {
  fleetJsonHeaders,
  mobilityBrowserBase,
  MOBILITY_DELIVERY_MODES,
  mobilityDeliveryModeLabel,
  type MobilityDeliveryMode,
  type MobilityEligibilityRecord,
} from "@/lib/mobility-api";

type Props = {
  workOrderId?: string;
  prefill?: {
    coveredVehicleReg?: string | null;
    workOrderDisplayNumber?: string | null;
  };
};

export function MobilityAssignmentForm({ workOrderId: initialWoId, prefill }: Props) {
  const router = useRouter();
  const [workOrderId] = useState(initialWoId ?? "");
  const [eligibility, setEligibility] = useState<MobilityEligibilityRecord | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(!!initialWoId);
  const [supplierId, setSupplierId] = useState("");
  const [replacementRegistration, setReplacementRegistration] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<MobilityDeliveryMode>("customer_pickup");
  const [handoverUserLabel, setHandoverUserLabel] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [notes, setNotes] = useState("");
  const [waive, setWaive] = useState(false);
  const [waivedReason, setWaivedReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialWoId) return;
    let cancelled = false;
    (async () => {
      setLoadingEligibility(true);
      try {
        const res = await fetch(`${mobilityBrowserBase}/eligibility/${initialWoId}`);
        if (res.ok && !cancelled) {
          setEligibility((await res.json()) as MobilityEligibilityRecord);
        }
      } finally {
        if (!cancelled) setLoadingEligibility(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWoId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!workOrderId) {
      setError("Lipsește comanda de lucru.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body = waive
        ? {
            workOrderId,
            status: "waived" as const,
            waivedReason: waivedReason.trim(),
            notes: notes.trim() || null,
          }
        : {
            workOrderId,
            supplierId: supplierId || null,
            replacementRegistration: replacementRegistration.trim(),
            deliveryMode,
            handoverUserLabel: handoverUserLabel.trim(),
            expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt).toISOString() : null,
            notes: notes.trim() || null,
            status: "active" as const,
            handoverAt: new Date().toISOString(),
          };
      const res = await fetch(`${mobilityBrowserBase}/assignments`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const saved = (await res.json()) as { id: string };
      router.push(`/fleet/mobility/replacement-cars/${saved.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const eligible = eligibility?.eligible ?? false;
  const hasActive = !!eligibility?.activeAssignment;
  const base = initialWoId ? 1 : 0;

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      {initialWoId ? (
        <OpsFormSection number={1} title="Eligibilitate">
          {loadingEligibility ? (
            <p className="text-sm text-zinc-500">Se calculează eligibilitatea…</p>
          ) : eligibility ? (
            <div className="space-y-2 text-sm">
              <p className="text-zinc-300">
                Comandă{" "}
                {prefill?.workOrderDisplayNumber ? (
                  <span className="font-mono text-violet-200">{prefill.workOrderDisplayNumber}</span>
                ) : null}
                {prefill?.coveredVehicleReg ? (
                  <>
                    {" · "}
                    <span className="font-mono">{prefill.coveredVehicleReg}</span>
                  </>
                ) : null}
              </p>
              <p className={eligible ? "text-amber-200" : "text-zinc-400"}>
                Imobilizare:{" "}
                <strong>{eligibility.immobilizationHours?.toFixed(1) ?? "—"}h</strong>
                {" · prag "}
                {eligibility.thresholdHours}h
                {eligible ? " · eligibil mobilitate" : " · sub prag"}
              </p>
              {hasActive ? (
                <p className="text-sky-300">
                  Există deja alocare{" "}
                  <Link
                    href={`/fleet/mobility/replacement-cars/${eligibility.activeAssignment!.id}`}
                    className="underline"
                  >
                    {eligibility.activeAssignment!.displayNumber ?? "activă"}
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-amber-400">Nu s-a putut încărca eligibilitatea.</p>
          )}
        </OpsFormSection>
      ) : null}

      <OpsFormSection number={base + 1} title="Acțiune">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} />
          Client renunță la mașina la schimb (înregistrare audit)
        </label>
      </OpsFormSection>

      {waive ? (
        <OpsFormSection number={base + 2} title="Renunțare">
          <OpsFormField label="Motiv renunțare" required>
            <textarea
              value={waivedReason}
              onChange={(e) => setWaivedReason(e.target.value)}
              className={`${OPS_INPUT_CLASS} min-h-[80px]`}
              required
            />
          </OpsFormField>
        </OpsFormSection>
      ) : (
        <>
          <OpsFormSection number={base + 2} title="Mașină la schimb">
            <OpsFormField label="Nr. înmatriculare mașină schimb" required>
              <input
                value={replacementRegistration}
                onChange={(e) => setReplacementRegistration(e.target.value)}
                className={OPS_INPUT_CLASS}
                placeholder="B 123 ABC"
                required
              />
            </OpsFormField>
            <OpsFormField label="Furnizor Rent">
              <SupplierCombobox value={supplierId} onChange={setSupplierId} category="rent" />
            </OpsFormField>
            <OpsFormField label="Mod predare" required>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as MobilityDeliveryMode)}
                className={OPS_INPUT_CLASS}
              >
                {MOBILITY_DELIVERY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {mobilityDeliveryModeLabel(m)}
                  </option>
                ))}
              </select>
            </OpsFormField>
            <OpsFormField label="Utilizator (cine primește mașina)" required>
              <input
                value={handoverUserLabel}
                onChange={(e) => setHandoverUserLabel(e.target.value)}
                className={OPS_INPUT_CLASS}
                placeholder="Nume șofer / contact client"
                required
              />
            </OpsFormField>
            <OpsFormField label="Estimare returnare">
              <input
                type="datetime-local"
                value={expectedReturnAt}
                onChange={(e) => setExpectedReturnAt(e.target.value)}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
          </OpsFormSection>
        </>
      )}

      <OpsFormSection number={base + 3} title="Note">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${OPS_INPUT_CLASS} min-h-[60px]`}
          placeholder="Observații interne"
        />
      </OpsFormSection>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <OpsFormStickyActions
        pending={pending}
        pendingLabel="Se salvează…"
        submitLabel={waive ? "Înregistrează renunțare" : "Activează mașina la schimb"}
        cancelHref="/fleet/mobility/replacement-cars"
        disabled={!waive && (hasActive || (!eligible && !!eligibility))}
      />
    </form>
  );
}
