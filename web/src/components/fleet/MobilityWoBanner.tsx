"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MOBILITY_ELIGIBILITY_HOURS,
  formatMobilityBenefitSummary,
  mobilityBrowserBase,
  mobilityStatusLabel,
  type MobilityEligibilityRecord,
} from "@/lib/mobility-api";

type Props = {
  workOrderId: string;
  canWrite: boolean;
};

export function MobilityWoBanner({ workOrderId, canWrite }: Props) {
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

  if (!data?.eligible && !data?.activeAssignment && !data?.benefitAssignment) return null;

  const hours = data.immobilizationHours?.toFixed(1) ?? "—";
  const active = data.activeAssignment;
  const benefit = data.benefitAssignment;

  return (
    <div className="border-b border-amber-800/50 bg-amber-950/30 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-amber-100">
          {active ? (
            <>
              <strong className="text-amber-200">Mobilitate:</strong> alocare{" "}
              <span className="font-mono">{active.displayNumber}</span>
              {active.replacementRegistration ? (
                <>
                  {" · "}
                  <span className="font-mono">{active.replacementRegistration}</span>
                </>
              ) : null}
              {" · "}
              {mobilityStatusLabel(active.status)}
              <span className="mt-1 block text-xs text-amber-200/80">{formatMobilityBenefitSummary(active)}</span>
            </>
          ) : benefit ? (
            <>
              <strong className="text-amber-200">Mobilitate înregistrată:</strong>{" "}
              {formatMobilityBenefitSummary(benefit)}
            </>
          ) : (
            <>
              <strong className="text-amber-200">Eligibil mașină la schimb</strong> — imobilizare {hours}h (prag{" "}
              {MOBILITY_ELIGIBILITY_HOURS}h). Clientul poate beneficia de mobilitate.
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {active ? (
            <Link
              href={`/fleet/mobility/replacement-cars/${active.id}`}
              className="rounded border border-amber-600/50 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-900/40"
            >
              Vezi alocare →
            </Link>
          ) : benefit ? (
            <Link
              href={`/fleet/mobility/replacement-cars/${benefit.id}`}
              className="rounded border border-amber-600/50 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-900/40"
            >
              Vezi alocare →
            </Link>
          ) : canWrite ? (
            <Link
              href={`/fleet/mobility/replacement-cars/new?wo=${workOrderId}`}
              className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-zinc-950 hover:bg-amber-500"
            >
              Alocă mașină schimb
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
