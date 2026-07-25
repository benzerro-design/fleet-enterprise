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
  /** Pe daună mașina la schimb e obligatorie înainte de reparație (În lucru). */
  damageRequired?: boolean;
};

export function MobilityWoBanner({ workOrderId, canWrite, damageRequired = false }: Props) {
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

  const active = data?.activeAssignment;
  const benefit = data?.benefitAssignment;
  const hasMobility = !!(
    active ||
    (benefit &&
      (benefit.status === "reserved" || benefit.status === "active" || benefit.status === "returned"))
  );

  if (!damageRequired && !data?.eligible && !active && !benefit) return null;

  const hours = data?.immobilizationHours?.toFixed(1) ?? "—";

  return (
    <div
      className={`border-b px-4 py-3 ${
        damageRequired && !hasMobility
          ? "border-rose-800/50 bg-rose-950/25"
          : "border-amber-800/50 bg-amber-950/30"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className={`text-sm ${damageRequired && !hasMobility ? "text-rose-100" : "text-amber-100"}`}>
          {active ? (
            <>
              <strong className={damageRequired ? "text-rose-200" : "text-amber-200"}>Mobilitate:</strong>{" "}
              alocare <span className="font-mono">{active.displayNumber}</span>
              {active.replacementRegistration ? (
                <>
                  {" · "}
                  <span className="font-mono">{active.replacementRegistration}</span>
                </>
              ) : null}
              {" · "}
              {mobilityStatusLabel(active.status)}
              <span className="mt-1 block text-xs opacity-80">{formatMobilityBenefitSummary(active)}</span>
            </>
          ) : benefit && hasMobility ? (
            <>
              <strong className="text-amber-200">Mobilitate înregistrată:</strong>{" "}
              {formatMobilityBenefitSummary(benefit)}
            </>
          ) : damageRequired ? (
            <>
              <strong className="text-rose-200">Daună — mașină la schimb obligatorie</strong> înainte de
              reparație / În lucru (împreună cu Accept plată pe dosar).
            </>
          ) : (
            <>
              <strong className="text-amber-200">Eligibil mașină la schimb</strong> — imobilizare {hours}h
              (prag {MOBILITY_ELIGIBILITY_HOURS}h). Clientul poate beneficia de mobilitate.
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
          ) : benefit && hasMobility ? (
            <Link
              href={`/fleet/mobility/replacement-cars/${benefit.id}`}
              className="rounded border border-amber-600/50 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-900/40"
            >
              Vezi alocare →
            </Link>
          ) : canWrite ? (
            <Link
              href={`/fleet/mobility/replacement-cars/new?wo=${workOrderId}`}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                damageRequired
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-amber-600 text-zinc-950 hover:bg-amber-500"
              }`}
            >
              Alocă mașină schimb
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
