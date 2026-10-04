"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { ListColumnPicker } from "@/components/fleet/ListColumnPicker";

export type SheetCol<K extends string> = {
  key: K;
  label: string;
  defaultVisible: boolean;
  canHide: boolean;
  width?: string;
  align?: "left" | "right";
};

type Layout<K extends string> = {
  order: K[];
  hidden: K[];
  rowLines: boolean;
  colLines: boolean;
};

function defaultLayout<K extends string>(columns: SheetCol<K>[]): Layout<K> {
  return {
    order: columns.map((c) => c.key),
    hidden: columns.filter((c) => !c.defaultVisible).map((c) => c.key),
    rowLines: true,
    colLines: false,
  };
}

type Props<K extends string, R> = {
  storageKey: string;
  pickerTitle: string;
  columns: SheetCol<K>[];
  rows: R[];
  rowKey: (row: R) => string;
  renderCell: (key: K, row: R) => ReactNode;
  empty: ReactNode;
  searchPlaceholder?: string;
  searchText?: (row: R) => string;
  statusOptions?: { value: string; label: string }[];
  rowStatus?: (row: R) => string;
  toolbarEnd?: ReactNode;
};

export function SheetListGrid<K extends string, R>({
  storageKey,
  pickerTitle,
  columns,
  rows,
  rowKey,
  renderCell,
  empty,
  searchPlaceholder,
  searchText,
  statusOptions,
  rowStatus,
  toolbarEnd,
}: Props<K, R>) {
  const [layout, setLayout] = useState<Layout<K>>(() => defaultLayout(columns));
  const [showColumns, setShowColumns] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  useEffect(() => {
    const cols = columnsRef.current;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Layout<K>>;
      const valid = new Set(cols.map((c) => c.key));
      const order = (parsed.order ?? []).filter((k): k is K => valid.has(k as K));
      for (const c of cols) {
        if (!order.includes(c.key)) order.push(c.key);
      }
      const hideable = new Set(cols.filter((c) => c.canHide).map((c) => c.key));
      const hidden = (parsed.hidden ?? []).filter(
        (k): k is K => valid.has(k as K) && hideable.has(k as K),
      );
      setLayout({
        order,
        hidden,
        rowLines: parsed.rowLines ?? true,
        colLines: parsed.colLines ?? false,
      });
    } catch {
      /* preferința implicită */
    }
  }, [storageKey]);

  function persist(next: Layout<K>) {
    setLayout(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage plin / privat */
    }
  }

  const visible = useMemo(() => {
    const hidden = new Set(layout.hidden);
    const byKey = new Map(columns.map((c) => [c.key, c]));
    return layout.order
      .filter((key) => !hidden.has(key))
      .map((key) => byKey.get(key))
      .filter((c): c is SheetCol<K> => Boolean(c));
  }, [columns, layout]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (status && rowStatus && rowStatus(row) !== status) return false;
      if (!needle || !searchText) return true;
      return searchText(row).toLowerCase().includes(needle);
    });
  }, [rows, q, status, rowStatus, searchText]);

  const rowLineCell = layout.rowLines ? "border-b border-zinc-700/70" : "";
  const colLineCell = layout.colLines ? "border-r border-zinc-700/70 last:border-r-0" : "";
  const thBase = `bg-zinc-950 px-3 py-2 text-left ${
    layout.rowLines ? "border-b border-zinc-700" : "border-b border-zinc-800/50"
  }`;

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => e.preventDefault()}
      >
        {searchText ? (
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Căutare</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder ?? "Caută…"}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            />
          </div>
        ) : null}
        {statusOptions && rowStatus ? (
          <div className="flex min-w-[10rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            >
              <option value="">Toate</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {searchText || statusOptions ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setStatus("");
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Resetează
          </button>
        ) : null}
        {toolbarEnd ? <div className="sm:ml-auto">{toolbarEnd}</div> : null}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
          <label className="inline-flex cursor-pointer items-center gap-2 hover:text-zinc-200">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
              checked={layout.rowLines}
              onChange={(e) => persist({ ...layout, rowLines: e.target.checked })}
            />
            Linii orizontale
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 hover:text-zinc-200">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
              checked={layout.colLines}
              onChange={(e) => persist({ ...layout, colLines: e.target.checked })}
            />
            Linii verticale
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowColumns((v) => !v)}
          className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
        >
          {showColumns ? "Închide coloane" : "Coloane…"}
        </button>
      </div>

      {showColumns ? (
        <ListColumnPicker
          title={pickerTitle}
          columns={columns}
          layout={layout}
          onChange={persist}
          onReset={() => persist(defaultLayout(columns))}
          onClose={() => setShowColumns(false)}
        />
      ) : null}

      {filtered.length === 0 ? (
        <div className="text-sm text-zinc-400">{empty}</div>
      ) : (
        <FleetDataTable>
          <table className={`${fleetTableClass} table-fixed`}>
            <colgroup>
              {visible.map((col) => (
                <col key={col.key} style={col.width ? { width: col.width } : undefined} />
              ))}
            </colgroup>
            <thead className={`${fleetTheadClass} tracking-wider`}>
              <tr>
                {visible.map((col) => (
                  <th
                    key={col.key}
                    className={`${thBase} ${colLineCell} ${col.align === "right" ? "text-right" : ""}`}
                  >
                    {col.key === "actions" ? <span className="sr-only">{col.label}</span> : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={rowKey(row)} className="bg-transparent transition-colors hover:bg-zinc-900/50">
                  {visible.map((col) => (
                    <td
                      key={col.key}
                      className={`${fleetTdClass} align-middle ${rowLineCell} ${colLineCell} ${
                        col.align === "right" ? "text-right" : ""
                      }`}
                    >
                      {renderCell(col.key, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </FleetDataTable>
      )}
    </div>
  );
}
