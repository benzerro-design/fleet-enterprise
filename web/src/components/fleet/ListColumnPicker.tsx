"use client";

type ColDef<K extends string> = {
  key: K;
  label: string;
  canHide: boolean;
};

type LayoutLike<K extends string> = {
  order: K[];
  hidden: K[];
  rowLines: boolean;
  colLines: boolean;
};

type Props<K extends string> = {
  title: string;
  columns: ColDef<K>[];
  layout: LayoutLike<K>;
  onChange: (layout: LayoutLike<K>) => void;
  onReset: () => void;
  onClose: () => void;
};

export function ListColumnPicker<K extends string>({
  title,
  columns,
  layout,
  onChange,
  onReset,
  onClose,
}: Props<K>) {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(columns.map((c) => [c.key, c]));

  function toggle(key: K) {
    const def = byKey.get(key);
    if (!def?.canHide) return;
    const nextHidden = new Set(layout.hidden);
    if (nextHidden.has(key)) nextHidden.delete(key);
    else nextHidden.add(key);
    onChange({ ...layout, hidden: [...nextHidden] });
  }

  function move(key: K, dir: -1 | 1) {
    const order = [...layout.order];
    const i = order.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    onChange({ ...layout, order });
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
          Închide
        </button>
      </div>
      <p className="mb-2 text-[11px] text-zinc-500">
        Arată / ascunde și reordonare (↑ ↓). Preferința rămâne pe acest browser.
      </p>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
        <span className="w-full text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Delimitare
        </span>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
            checked={layout.rowLines}
            onChange={(e) => onChange({ ...layout, rowLines: e.target.checked })}
          />
          Linii orizontale
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
            checked={layout.colLines}
            onChange={(e) => onChange({ ...layout, colLines: e.target.checked })}
          />
          Linii verticale
        </label>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {layout.order.map((key) => {
          const def = byKey.get(key);
          if (!def) return null;
          return (
            <li
              key={key}
              className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-2 py-1.5"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40 disabled:opacity-40"
                  checked={!hidden.has(key)}
                  disabled={!def.canHide}
                  onChange={() => toggle(key)}
                />
                <span className="truncate">{def.label}</span>
              </label>
              <button
                type="button"
                className="rounded px-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => move(key, -1)}
                aria-label={`Mută ${def.label} în sus`}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded px-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => move(key, 1)}
                aria-label={`Mută ${def.label} în jos`}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Reset layout
        </button>
      </div>
    </div>
  );
}
