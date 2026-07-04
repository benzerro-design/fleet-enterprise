"use client";

import type { ServiceCaseRecord } from "@/lib/service-cases-api";

type Props = {
  serviceCase: ServiceCaseRecord;
  awaitingDecision: boolean;
  canOperate: boolean;
  closed: boolean;
  pending: boolean;
  onImmediate: () => void;
  onReschedule: () => void;
};

/** Fork vizual între Aprobare deviz și Facturat — reparație directă vs reprogramare. */
export function OperationalFlowFork({
  serviceCase,
  awaitingDecision,
  canOperate,
  closed,
  pending,
  onImmediate,
  onReschedule,
}: Props) {
  const path = serviceCase.postApprovalPath;
  const showFork =
    awaitingDecision ||
    path === "immediate" ||
    path === "reschedule" ||
    serviceCase.currentStage === "approval";

  if (!showFork) return null;

  const decided = path === "immediate" || path === "reschedule";

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">Decizie după aprobare deviz</p>

      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
        <div className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1.5 text-center text-xs text-emerald-200">
          Aprobare deviz
        </div>

        <div className="hidden shrink-0 text-zinc-600 sm:block" aria-hidden>
          →
        </div>

        {awaitingDecision && canOperate && !closed ? (
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-zinc-500">Reparație în service</span>
              <button
                type="button"
                disabled={pending}
                onClick={onImmediate}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Continuă reparația → Facturat
              </button>
            </div>

            <div className="flex items-center justify-center text-zinc-600 sm:flex-col sm:py-4">
              <span className="text-[10px] text-zinc-500">sau</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-zinc-500">↓ Reprogramare</span>
              <button
                type="button"
                disabled={pending}
                onClick={onReschedule}
                className="rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/50 disabled:opacity-50"
              >
                Programează din nou
              </button>
              <span className="text-[10px] text-zinc-500">↑ apoi Facturat</span>
            </div>
          </div>
        ) : decided ? (
          <div className="flex flex-1 flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {path === "immediate" ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-center text-xs text-emerald-200">
                Reparație directă — devizul rămâne pe comandă
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="rounded-md border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
                  Reprogramare — devizul aprobat rămâne valid
                </div>
                <span className="text-[10px] text-zinc-500">După reparație → Facturat → Cost</span>
              </div>
            )}
            <div className="hidden text-zinc-600 sm:block">→</div>
            <div className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300">Facturat</div>
          </div>
        ) : (
          <div className="text-center text-xs text-zinc-500">Aprobă devizul pentru a alege ramura</div>
        )}
      </div>
    </div>
  );
}
