"use client";

import { VehicleMultiSelect } from "@/components/fleet/VehicleMultiSelect";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import type { VehicleMultiSelectOption } from "@/components/fleet/VehicleMultiSelect";

type Props = {
  vehicles: VehicleMultiSelectOption[];
  periodFrom: string;
  periodTo: string;
  selectedVehicleIds: string[];
};

export function ConsumptionFilterForm({ vehicles, periodFrom, periodTo, selectedVehicleIds }: Props) {
  return (
    <form
      action="/fleet/trips"
      method="get"
      className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <input type="hidden" name="view" value="consumption" />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-[9rem] flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Perioadă de la</label>
          <input
            name="periodFrom"
            type="date"
            required
            defaultValue={periodFrom}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex min-w-[9rem] flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Perioadă până la</label>
          <input
            name="periodTo"
            type="date"
            required
            defaultValue={periodTo}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
          Aplică
        </button>
        <FilterResetLink href="/fleet/trips?view=consumption" />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500">Vehicule</p>
        <VehicleMultiSelect vehicles={vehicles} selectedIds={selectedVehicleIds} />
      </div>
    </form>
  );
}
