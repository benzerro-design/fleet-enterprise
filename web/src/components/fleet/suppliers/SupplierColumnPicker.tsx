"use client";

import {
  SUPPLIER_GRID_COLUMNS,
  type SupplierGridColumnKey,
  type SupplierGridLayout,
  writeSupplierGridLayout,
} from "@/lib/supplier-grid-columns";

type Props = {
  layout: SupplierGridLayout;
  onChange: (layout: SupplierGridLayout) => void;
  onClose: () => void;
};

export function SupplierColumnPicker({ layout, onChange, onClose }: Props) {
  const hidden = new Set(layout.hidden);

  function toggle(key: SupplierGridColumnKey) {
    const def = SUPPLIER_GRID_COLUMNS.find((c) => c.key === key);
    if (!def?.canHide) return;
    const nextHidden = new Set(layout.hidden);
    if (nextHidden.has(key)) nextHidden.delete(key);
    else nextHidden.add(key);
    const next = { ...layout, hidden: [...nextHidden] };
    onChange(next);
    writeSupplierGridLayout(next);
  }

  function move(key: SupplierGridColumnKey, dir: -1 | 1) {
    const order = [...layout.order];
    const i = order.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const next = { ...layout, order };
    onChange(next);
    writeSupplierGridLayout(next);
  }

  function reset() {
    const order = SUPPLIER_GRID_COLUMNS.map((c) => c.key);
    const hiddenKeys = SUPPLIER_GRID_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key);
    const next = { order, hidden: hiddenKeys };
    onChange(next);
    writeSupplierGridLayout(next);
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-100">Coloane listă</h3>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
          Închide
        </button>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {layout.order.map((key) => {
          const def = SUPPLIER_GRID_COLUMNS.find((c) => c.key === key);
          if (!def) return null;
          const isHidden = hidden.has(key);
          return (
            <li
              key={key}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-xs"
            >
              <span className="min-w-[5rem] font-medium text-zinc-300">{def.label || def.key}</span>
              <div className="ml-auto flex gap-1">
                <button type="button" className="rounded border border-zinc-700 px-1.5 py-0.5 hover:bg-zinc-800" onClick={() => move(key, -1)}>
                  ↑
                </button>
                <button type="button" className="rounded border border-zinc-700 px-1.5 py-0.5 hover:bg-zinc-800" onClick={() => move(key, 1)}>
                  ↓
                </button>
                {def.canHide ? (
                  <button
                    type="button"
                    className={`rounded border px-1.5 py-0.5 ${isHidden ? "border-emerald-800 text-emerald-300" : "border-zinc-700 text-zinc-400"} hover:bg-zinc-800`}
                    onClick={() => toggle(key)}
                  >
                    {isHidden ? "Arată" : "Ascunde"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={reset} className="mt-3 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">
        Reset layout
      </button>
    </div>
  );
}
