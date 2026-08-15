"use client";

import { useState } from "react";
import {
  fleetJsonHeaders,
  serviceCasesBrowserBase,
  type DamageSettlementRound,
  type ServiceCaseRecord,
} from "@/lib/service-cases-api";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";

type Props = {
  serviceCaseId: string;
  rounds: DamageSettlementRound[];
  selectedRoundId: string | null;
  onSelectRound: (id: string) => void;
  canWrite: boolean;
  pending?: boolean;
  onOpened: (next: ServiceCaseRecord) => void;
  onError: (msg: string) => void;
};

export function DamageSettlementRoundsBar({
  serviceCaseId,
  rounds,
  selectedRoundId,
  onSelectRound,
  canWrite,
  pending,
  onOpened,
  onError,
}: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const sorted = [...rounds].sort((a, b) => a.sequence - b.sequence);
  const active = sorted.find((r) => r.status === "active");

  async function openRound() {
    if (reason.trim().length < 5) {
      onError("Motivul rundei noi — minim 5 caractere.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${serviceCasesBrowserBase}/${serviceCaseId}/damage-claim/open-settlement-round`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({ reason: reason.trim(), reopenWorkOrder: true }),
        },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          /* ignore */
        }
        onError(msg);
        return;
      }
      const next = (await res.json()) as ServiceCaseRecord;
      onOpened(next);
      setReason("");
      setOpenForm(false);
      const newActive = (next.damageSettlementRounds ?? []).find((r) => r.status === "active");
      if (newActive) onSelectRound(newActive.id);
    } finally {
      setBusy(false);
    }
  }

  if (!sorted.length) return null;

  return (
    <div className="space-y-3 rounded-lg border border-violet-800/40 bg-violet-950/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
            Runde de decontare
          </h4>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Fiecare rundă = reconstatare + deviz + accept plată. Runda anterioară rămâne arhivată.
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            disabled={pending || busy}
            onClick={() => setOpenForm((v) => !v)}
            className="rounded-lg border border-amber-600/50 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/50 disabled:opacity-50"
          >
            {openForm ? "Anulează" : "+ Rundă nouă (omisiune)"}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sorted.map((r) => {
          const selected = r.id === selectedRoundId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectRound(r.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                selected
                  ? "border-violet-500 bg-violet-600/30 text-violet-100"
                  : "border-zinc-700 bg-zinc-950/40 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              Runda {r.sequence}
              {r.status === "active" ? (
                <span className="ml-1.5 text-[10px] text-emerald-400">activă</span>
              ) : (
                <span className="ml-1.5 text-[10px] text-zinc-600">închisă</span>
              )}
            </button>
          );
        })}
      </div>

      {active && selectedRoundId === active.id && !active.paymentAcceptanceId ? (
        <p className="text-[11px] text-amber-200/90">
          Runda {active.sequence} așteaptă reconstatare / deviz / accept plată nou. Până la accept,
          reparația delta e blocată de gate-ul asigurător.
        </p>
      ) : null}

      {openForm ? (
        <div className="space-y-2 border-t border-violet-900/40 pt-3">
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Motiv (obligatoriu)</span>
            <textarea
              className={`${OPS_INPUT_CLASS} min-h-[3.5rem]`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex. Avarie ascunsă descoperită la demontare — lipsește din constatare/reconstatare"
              disabled={busy}
            />
          </label>
          <p className="text-[10px] text-zinc-500">
            Deschide Runda {(active?.sequence ?? 0) + 1}, închide runda curentă, setează programare
            din nou pe WO și permite reintrarea în reparație.
          </p>
          <button
            type="button"
            disabled={busy || reason.trim().length < 5}
            onClick={() => void openRound()}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? "Se deschide…" : "Deschide runda nouă"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
