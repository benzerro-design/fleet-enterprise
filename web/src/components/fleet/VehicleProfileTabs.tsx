"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { VehicleAdvancedCivTab } from "@/components/fleet/VehicleAdvancedCivTab";
import { VehicleBasicInfoTab } from "@/components/fleet/VehicleBasicInfoTab";
import { VehicleOdometerTab } from "@/components/fleet/VehicleOdometerTab";
import type { VehicleRecord } from "@/lib/fleet-api";
import type {
  OdometerReadingsPayload,
  VehicleCivPayload,
  VehicleProfileTab,
} from "@/lib/vehicle-profile-types";

const TABS: { id: VehicleProfileTab; label: string }[] = [
  { id: "basic", label: "Basic Info" },
  { id: "advanced", label: "Advanced Infos" },
  { id: "odometer", label: "Odometru" },
];

type Props = {
  vehicle: VehicleRecord;
  write: boolean;
  civ: VehicleCivPayload;
  odometer: OdometerReadingsPayload;
};

export function VehicleProfileTabs({ vehicle, write, civ, odometer }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = useMemo((): VehicleProfileTab => {
    const t = searchParams.get("tab");
    if (t === "advanced" || t === "odometer" || t === "basic") return t;
    return "basic";
  }, [searchParams]);

  const setTab = useCallback(
    (tab: VehicleProfileTab) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", tab);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`rounded-t-lg border px-4 py-2 text-sm transition-colors ${
                active === tab.id
                  ? "border-zinc-700 border-b-zinc-900 bg-zinc-900 text-emerald-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {active === "basic" ? (
          <VehicleBasicInfoTab vehicle={vehicle} write={write} />
        ) : null}
        {active === "advanced" ? (
          <VehicleAdvancedCivTab vehicle={vehicle} write={write} initial={civ} />
        ) : null}
        {active === "odometer" ? (
          <VehicleOdometerTab vehicleId={vehicle.id} write={write} initial={odometer} />
        ) : null}
      </div>
    </section>
  );
}
