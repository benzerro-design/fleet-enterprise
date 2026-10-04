"use client";

import {
  defaultVehicleGridLayout,
  VEHICLE_GRID_COLUMNS,
  type VehicleGridColumnDef,
  type VehicleGridColumnKey,
  type VehicleGridLayout,
  writeVehicleGridLayout,
} from "@/lib/vehicle-grid-columns";
import { useT } from "@/lib/i18n/useT";

type Props = {
  layout: VehicleGridLayout;
  columns?: VehicleGridColumnDef[];
  onChange: (layout: VehicleGridLayout) => void;
  onClose: () => void;
};

export function VehicleColumnPicker({ layout, columns = VEHICLE_GRID_COLUMNS, onChange, onClose }: Props) {
  const tx = useT();
  const hidden = new Set(layout.hidden);

  function toggle(key: VehicleGridColumnKey) {
    const def = columns.find((c) => c.key === key);
    if (!def?.canHide) return;
    const nextHidden = new Set(layout.hidden);
    if (nextHidden.has(key)) nextHidden.delete(key);
    else nextHidden.add(key);
    const next = { ...layout, hidden: [...nextHidden] };
    onChange(next);
    writeVehicleGridLayout(next);
  }

  function move(key: VehicleGridColumnKey, dir: -1 | 1) {
    const order = [...layout.order];
    const i = order.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const next = { ...layout, order };
    onChange(next);
    writeVehicleGridLayout(next);
  }

  function reset() {
    const next = defaultVehicleGridLayout();
    onChange(next);
    writeVehicleGridLayout(next);
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-100">{tx("ops.grids.vehicles.columnPickerTitle")}</h3>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
          {tx("common.close")}
        </button>
      </div>
      <p className="mb-2 text-[11px] text-zinc-500">
        {tx("ops.grids.columnPicker.description")}
      </p>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
        <span className="w-full text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {tx("ops.grids.columnPicker.dividers")}
        </span>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
            checked={layout.rowLines}
            onChange={(e) => {
              const next = { ...layout, rowLines: e.target.checked };
              onChange(next);
              writeVehicleGridLayout(next);
            }}
          />
          {tx("ops.grids.controls.rowLines")}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
            checked={layout.colLines}
            onChange={(e) => {
              const next = { ...layout, colLines: e.target.checked };
              onChange(next);
              writeVehicleGridLayout(next);
            }}
          />
          {tx("ops.grids.controls.colLines")}
        </label>
      </div>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {layout.order.map((key) => {
          const def = columns.find((c) => c.key === key);
          if (!def) return null;
          const isHidden = hidden.has(key);
          return (
            <li
              key={key}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-xs"
            >
              <span className="min-w-[7rem] font-medium text-zinc-300">{def.label}</span>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  className="rounded border border-zinc-700 px-1.5 py-0.5 hover:bg-zinc-800"
                  onClick={() => move(key, -1)}
                  aria-label={`${tx("ops.grids.columnPicker.moveUp")} ${def.label}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-700 px-1.5 py-0.5 hover:bg-zinc-800"
                  onClick={() => move(key, 1)}
                  aria-label={`${tx("ops.grids.columnPicker.moveDown")} ${def.label}`}
                >
                  ↓
                </button>
                {def.canHide ? (
                  <button
                    type="button"
                    className={`rounded border px-1.5 py-0.5 ${
                      isHidden ? "border-emerald-800 text-emerald-300" : "border-zinc-700 text-zinc-400"
                    } hover:bg-zinc-800`}
                    onClick={() => toggle(key)}
                  >
                    {isHidden ? tx("ops.grids.columnPicker.show") : tx("ops.grids.columnPicker.hide")}
                  </button>
                ) : (
                  <span className="px-1.5 py-0.5 text-[10px] text-zinc-600">{tx("ops.grids.columnPicker.required")}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
      >
        Reset layout
      </button>
    </div>
  );
}
