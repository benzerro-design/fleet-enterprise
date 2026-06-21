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

export function ConsumptionFilterForm({
  vehicles,
  periodFrom,
  periodTo,
  selectedVehicleIds,
  selectedFuelTypes,
}: Props) {
  return (
    <form
      action="/fleet/trips"
      method="get"
      className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <input type="hidden" name="view" value="consumption" />
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
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
        <div className="min-w-[14rem] flex-1 flex-col gap-1 lg:flex">
          <label className="text-xs font-medium text-zinc-500">Vehicule</label>
          <VehicleMultiSelect vehicles={vehicles} selectedIds={selectedVehicleIds} />
        </div>
        <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
          Aplică
        </button>
        <FilterResetLink href="/fleet/trips?view=consumption" />
      </div>
      <div className="mt-3 border-t border-zinc-800 pt-3">
        <label className="mb-2 block text-xs font-medium text-zinc-500">Tip combustibil / energie</label>
        <FuelTypeFilter selected={selectedFuelTypes} />
        <p className="mt-2 text-xs text-zinc-500">
          Filtrează vehiculele după tipul de energie (CIV P.3 sau profil vehicul). Poți combina cu selecția manuală de vehicule.
        </p>
      </div>
    </form>
  );
}
