"use client";

import { VehicleMultiSelect } from "@/components/fleet/VehicleMultiSelect";
import { FuelTypeFilter } from "@/components/fleet/FuelTypeFilter";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import type { VehicleMultiSelectOption } from "@/components/fleet/VehicleMultiSelect";
import type { FuelTypeValue } from "@/lib/fuel-types";

type Props = {
  vehicles: VehicleMultiSelectOption[];
  periodFrom: string;
  periodTo: string;
  selectedVehicleIds: string[];
  selectedFuelTypes: FuelTypeValue[];
};

const fieldLabel = "text-[10px] font-medium uppercase tracking-wide text-zinc-500";
const fieldInput = "rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs";
const filterBtn = "rounded-md bg-zinc-800 px-3 py-1.5 text-xs";
const resetBtn = "rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900";

export function ConsumptionFilterForm({
  vehicles,
  periodFrom,
  periodTo,
  selectedVehicleIds,
  selectedFuelTypes,
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
          <button type="submit" className={filterBtn}>
            Aplică
          </button>
          <FilterResetLink href="/fleet/trips?view=consumption" className={resetBtn} />
        </div>
        <div className="min-w-0 flex-1 flex-col gap-0.5 xl:flex">
          <label className={fieldLabel}>Vehicule</label>
          <VehicleMultiSelect vehicles={vehicles} selectedIds={selectedVehicleIds} compact />
        </div>
        <div className="min-w-0 flex-1 flex-col gap-0.5 xl:flex xl:min-w-[20rem]">
          <label className={fieldLabel}>Tip energie</label>
          <FuelTypeFilter selected={selectedFuelTypes} compact />
        </div>
      </div>
    </form>
  );
}
