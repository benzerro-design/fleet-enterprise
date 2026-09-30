"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fleetJsonHeaders,
  formatMobilityBenefitSummary,
  mobilityBrowserBase,
  mobilityStatusLabel,
  type MobilityAssignmentRecord,
  type MobilityEligibilityRecord,
} from "@/lib/mobility-api";

type Props = {
  workOrderId: string;
  canWrite?: boolean;
  partnerMode?: boolean;
};

function fmt(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("ro-RO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function MobilityDetailRows({ m }: { m: MobilityAssignmentRecord }) {
  return (
    <dl className="mt-2 space-y-1 text-xs text-zinc-300">
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Data predare (IN)</dt>
        <dd className="text-right text-zinc-200">{fmt(m.handoverAt)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Data returnare (OUT)</dt>
        <dd className="text-right text-zinc-200">
          {m.returnedAt ? fmt(m.returnedAt) : m.status === "active" ? "în curs" : fmt(m.expectedReturnAt)}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Nr. mașină schimb</dt>
        <dd className="font-mono text-zinc-100">{m.replacementRegistration ?? "—"}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Furnizor rent</dt>
        <dd className="text-right text-zinc-200">{m.supplierLegalName ?? "—"}</dd>
      </div>
      {m.handoverProtocolUrl ? (
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">PV predare-primire</dt>
          <dd className="text-right">
            <a
              href={m.handoverProtocolUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 hover:underline"
            >
              {m.handoverProtocolFileName?.trim() || "Deschide PDF"}
            </a>
          </dd>
        </div>
      ) : null}
      {m.notes?.trim() ? (
        <div className="border-t border-zinc-800 pt-1 text-zinc-400">{m.notes.trim()}</div>
      ) : null}
    </dl>
  );
}

export function WorkOrderMobilitySummary({ workOrderId, canWrite = false, partnerMode = false }: Props) {
  const [data, setData] = useState<MobilityEligibilityRecord | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnPending, setReturnPending] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`${mobilityBrowserBase}/eligibility/${workOrderId}`);
      if (res.ok) {
        setData((await res.json()) as MobilityEligibilityRecord);
      }
    } catch {
      /* ignore */
    }
  }, [workOrderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const benefit = data?.benefitAssignment;
  if (!benefit) return null;

  const waived = benefit.status === "waived";
  const showHandoverRegistered =
    !waived && benefit.handoverAt && (benefit.status === "active" || benefit.status === "returned" || benefit.status === "reserved");
  const canConfirmReturn = canWrite && benefit.status === "active";

  async function confirmReturn() {
    if (!benefit) return;
    if (!window.confirm("Confirmi returnarea mașinii la schimb?")) return;
    setReturnPending(true);
    setReturnError(null);
    try {
      const res = await fetch(`${mobilityBrowserBase}/assignments/${benefit.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          status: "returned",
          returnedAt: new Date().toISOString(),
          ...(returnNotes.trim()
            ? {
                notes: benefit.notes?.trim()
                  ? `${benefit.notes.trim()}\n\nReturnare: ${returnNotes.trim()}`
                  : returnNotes.trim(),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setReturnError(msg);
        return;
      }
      setReturnNotes("");
      await reload();
    } finally {
      setReturnPending(false);
    }
  }

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Mașină la schimb</p>
          {showHandoverRegistered ? (
            <p className="mt-1 rounded-md border border-emerald-800/40 bg-emerald-950/25 px-2.5 py-1.5 text-sm text-emerald-100">
              <strong>Predare înregistrată</strong>
              {" · "}
              {fmt(benefit.handoverAt)}
              {benefit.handoverUserLabel?.trim() ? (
                <>
                  {" · "}
                  <span className="text-emerald-200/90">{benefit.handoverUserLabel.trim()}</span>
                </>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-zinc-100">
            {waived ? (
              <>
                Clientul <strong className="text-zinc-200">nu a beneficiat</strong> de mașină la schimb pe durata reparației.
              </>
            ) : (
              <>
                Clientul a beneficiat de mașină la schimb pe durata reparației
                {(benefit.status === "active" || benefit.status === "reserved") && (
                  <span className="text-emerald-400"> (în curs)</span>
                )}
                .
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{formatMobilityBenefitSummary(benefit)}</p>
          {!waived ? <MobilityDetailRows m={benefit} /> : null}
          {canConfirmReturn ? (
            <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <p className="text-xs text-zinc-400">
                {partnerMode
                  ? "Înregistrează returnarea mașinii la schimb când clientul o aduce înapoi."
                  : "Marchează returnarea mașinii la schimb."}
              </p>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
                placeholder="Note returnare (opțional)"
                rows={2}
              />
              <button
                type="button"
                disabled={returnPending}
                onClick={() => void confirmReturn()}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {returnPending ? "Se salvează…" : "Confirmă returnare"}
              </button>
              {returnError ? <p className="text-xs text-red-400">{returnError}</p> : null}
            </div>
          ) : null}
          <p className="mt-1 text-[10px] text-zinc-600">
            {benefit.displayNumber ? (
              <span className="font-mono">{benefit.displayNumber}</span>
            ) : null}
            {benefit.displayNumber ? " · " : null}
            {mobilityStatusLabel(benefit.status)}
          </p>
        </div>
        <Link
          href={`/fleet/mobility/replacement-cars/${benefit.id}`}
          className="shrink-0 rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Detalii alocare →
        </Link>
      </div>
    </div>
  );
}
