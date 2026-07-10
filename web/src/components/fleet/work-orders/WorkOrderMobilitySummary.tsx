"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatMobilityBenefitSummary,
  mobilityBrowserBase,
  mobilityStatusLabel,
  type MobilityAssignmentRecord,
  type MobilityEligibilityRecord,
} from "@/lib/mobility-api";

type Props = {
  workOrderId: string;
};

function MobilityDetailRows({ m }: { m: MobilityAssignmentRecord }) {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("ro-RO", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

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
      {m.notes?.trim() ? (
        <div className="border-t border-zinc-800 pt-1 text-zinc-400">{m.notes.trim()}</div>
      ) : null}
    </dl>
  );
}

export function WorkOrderMobilitySummary({ workOrderId }: Props) {
  const [data, setData] = useState<MobilityEligibilityRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${mobilityBrowserBase}/eligibility/${workOrderId}`);
        if (res.ok && !cancelled) {
          setData((await res.json()) as MobilityEligibilityRecord);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const benefit = data?.benefitAssignment;
  if (!benefit) return null;

  const waived = benefit.status === "waived";

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Mașină la schimb</p>
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
