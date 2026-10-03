"use client";

import { useState, type ReactNode } from "react";

export type CatalogRow = {
  code: string;
  label: string;
  enabled: boolean;
  system: boolean;
};

export function newSlug(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `item_${Date.now().toString(36)}`;
}

type Props<T extends CatalogRow> = {
  rows: T[];
  pending: boolean;
  onChange: (next: T[]) => void;
  extra?: (row: T, idx: number) => ReactNode;
  makeRow: (code: string, label: string) => T;
  addPlaceholder?: string;
};

export function CatalogRowsEditor<T extends CatalogRow>({
  rows,
  pending,
  onChange,
  extra,
  makeRow,
  addPlaceholder = "Etichetă nouă",
}: Props<T>) {
  const [newLabel, setNewLabel] = useState("");

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li
            key={row.code}
            className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={pending}
                  onChange={(e) => {
                    const next = rows.map((r, i) =>
                      i === idx ? { ...r, enabled: e.target.checked } : r,
                    );
                    onChange(next);
                  }}
                />
                Activ
              </label>
              <code className="text-[11px] text-zinc-500">{row.code}</code>
              {row.system ? (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  sistem
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  className="text-[11px] text-red-400 hover:text-red-300"
                  onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                >
                  Șterge
                </button>
              )}
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  disabled={pending || idx === 0}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 disabled:opacity-30"
                  onClick={() => {
                    const next = [...rows];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    onChange(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={pending || idx >= rows.length - 1}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 disabled:opacity-30"
                  onClick={() => {
                    const next = [...rows];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    onChange(next);
                  }}
                >
                  ↓
                </button>
              </div>
            </div>
            <input
              type="text"
              value={row.label}
              disabled={pending}
              onChange={(e) => {
                const next = rows.map((r, i) =>
                  i === idx ? { ...r, label: e.target.value } : r,
                );
                onChange(next);
              }}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            />
            {extra?.(row, idx)}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newLabel}
          disabled={pending}
          placeholder={addPlaceholder}
          onChange={(e) => setNewLabel(e.target.value)}
          className="min-w-[12rem] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
        />
        <button
          type="button"
          disabled={pending || !newLabel.trim()}
          onClick={() => {
            const label = newLabel.trim();
            let code = newSlug(label);
            const codes = new Set(rows.map((r) => r.code));
            if (codes.has(code)) code = `${code}_${Date.now().toString(36).slice(-4)}`;
            onChange([...rows, makeRow(code, label)]);
            setNewLabel("");
          }}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
        >
          Adaugă
        </button>
      </div>
    </div>
  );
}
