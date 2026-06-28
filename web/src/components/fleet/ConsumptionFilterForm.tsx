"use client";

import { VehicleMultiSelect } from "@/components/fleet/VehicleMultiSelect";
import { FuelTypeFilter } from "@/components/fleet/FuelTypeFilter";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { DriverFilterSelect } from "@/components/fleet/DriverFilterSelect";
import type { DriverRecord } from "@/lib/drivers-api";
import type { VehicleMultiSelectOption } from "@/components/fleet/VehicleMultiSelect";
import type { FuelTypeValue } from "@/lib/fuel-types";

type Props = {
  vehicles: VehicleMultiSelectOption[];
  drivers: DriverRecord[];
  periodFrom: string;
  periodTo: string;
  selectedVehicleIds: string[];
  selectedFuelTypes: FuelTypeValue[];
  selectedDriverId: string;
};

const fieldLabel = "text-[10px] font-medium uppercase tracking-wide text-zinc-500";
const fieldInput = "rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs";
const filterBtn = "rounded-md bg-zinc-800 px-3 py-1.5 text-xs";
const resetBtn = "rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900";

export function ConsumptionFilterForm({
  vehicles,
  drivers,
  periodFrom,
  periodTo,
  selectedVehicleIds,
  selectedFuelTypes,
  selectedDriverId,
}: Props) {
  return (
    <form action="/fleet/trips" method="get" className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <input type="hidden" name="view" value="consumption" />
      <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-0.5">
            <label className={fieldLabel}>De la</label>
            <input
              name="periodFrom"
              type="date"
              required
              defaultValue={periodFrom}
              className={`${fieldInput} w-[8.5rem]`}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className={fieldLabel}>Până la</label>
            <input
              name="periodTo"
              type="date"
              required
              defaultValue={periodTo}
              className={`${fieldInput} w-[8.5rem]`}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 flex-col gap-0.5 xl:flex xl:min-w-[14rem]">
          <DriverFilterSelect drivers={drivers} value={selectedDriverId} compact />
        </div>
        <div className="min-w-0 flex-1 flex-col gap-0.5 xl:flex xl:min-w-[20rem]">
          <label className={fieldLabel}>Tip energie (alimentări)</label>
          <FuelTypeFilter selected={selectedFuelTypes} compact />
        </div>
        <div className="flex shrink-0 items-end justify-end gap-2 xl:ml-auto">
          <button type="submit" className={filterBtn}>
            Aplică
          </button>
          <FilterResetLink href="/fleet/trips?view=consumption" className={resetBtn} />
        </div>
      </div>
      <div className="mt-2 border-t border-zinc-800 pt-2">
        <label className={`${fieldLabel} mb-1 block`}>Vehicule</label>
        <VehicleMultiSelect
          vehicles={vehicles}
          selectedIds={selectedVehicleIds}
          compact
          defaultOpen={selectedVehicleIds.length > 0}
        />
      </div>
    </form>
  );
}
