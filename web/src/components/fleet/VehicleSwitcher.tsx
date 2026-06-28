"use client";

import type { OpsVehicleOption } from "@/lib/ops-form-context";
import { pushRecentVehicleId, readRecentVehicleIds } from "@/lib/vehicle-recent-storage";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  currentId: string;
  currentRegistration: string;
  currentModelLabel: string;
  currentOdometerKm: number;
  currentClientId: string;
  vehicles: OpsVehicleOption[];
  mode: "view" | "edit";
};

function modelLabelFromOption(v: OpsVehicleOption): string {
  const brand = v.civProfile?.brand ?? v.civProfile?.marca;
  const model = v.civProfile?.model;
  const parts = [brand, model].filter((x) => x != null && String(x).trim()).map(String);
  return parts.length ? parts.join(" ") : "—";
}

function matchesQuery(v: OpsVehicleOption, q: string): boolean {
  const hay = [
    v.registrationNumber,
    v.clientId,
    modelLabelFromOption(v),
    v.fuelType ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function VehicleSwitcher({
  currentId,
  currentRegistration,
  currentModelLabel,
  currentOdometerKm,
  currentClientId,
  vehicles,
  mode,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const base = q ? vehicles.filter((v) => matchesQuery(v, q)) : vehicles;
    return [...base].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber, "ro"));
  }, [vehicles, q]);

  const recentVehicles = useMemo(() => {
    if (q) return [];
    return recentIds
      .map((id) => vehicles.find((v) => v.id === id))
      .filter((v): v is OpsVehicleOption => v != null && v.id !== currentId);
  }, [recentIds, vehicles, q, currentId]);

  const listItems = useMemo(() => {
    if (q) return filtered;
    const recentSet = new Set(recentVehicles.map((v) => v.id));
    const rest = filtered.filter((v) => !recentSet.has(v.id));
    return [...recentVehicles, ...rest];
  }, [filtered, q, recentVehicles]);

  const navigateTo = useCallback(
    (vehicleId: string) => {
      if (vehicleId === currentId) {
        setOpen(false);
        return;
      }
      pushRecentVehicleId(vehicleId);
      setRecentIds(readRecentVehicleIds());
      const qs = searchParams.toString();
      const suffix = qs ? `?${qs}` : "";
      const base = mode === "edit" ? `/fleet/vehicles/${vehicleId}/edit` : `/fleet/vehicles/${vehicleId}`;
      setOpen(false);
      setQuery("");
      router.push(`${base}${suffix}`);
    },
    [currentId, mode, router, searchParams],
  );

  useEffect(() => {
    if (open) {
      setRecentIds(readRecentVehicleIds());
      setHighlightIdx(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setQuery("");
    setHighlightIdx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, Math.max(0, listItems.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && listItems[highlightIdx]) {
        e.preventDefault();
        navigateTo(listItems[highlightIdx].id);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, highlightIdx, listItems, navigateTo]);

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onGlobalKey);
    return () => document.removeEventListener("keydown", onGlobalKey);
  }, []);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  if (vehicles.length === 0) {
    return (
      <h1 className="mt-2 text-3xl font-semibold tracking-tight font-mono">{currentRegistration}</h1>
    );
  }

  return (
    <div ref={rootRef} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex w-full max-w-xl items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors sm:w-auto ${
          open
            ? "border-emerald-700/60 bg-emerald-950/30 ring-2 ring-emerald-500/30"
            : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/80"
        }`}
      >
        <span className="min-w-0">
          <span className="block font-mono text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            {currentRegistration}
          </span>
          <span className="mt-1 block text-sm text-zinc-400">
            {currentModelLabel}
            <span className="mx-2 text-zinc-600">·</span>
            <span className="font-mono text-sky-300/90">{currentOdometerKm.toLocaleString("ro-RO")} km</span>
            <span className="mx-2 text-zinc-600">·</span>
            client <span className="font-mono text-zinc-300">{currentClientId}</span>
          </span>
        </span>
        <span className="mt-1 shrink-0 text-xs text-zinc-500" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Schimbă vehiculul"
          className="absolute left-0 top-full z-50 mt-2 w-full min-w-[min(100vw-2rem,24rem)] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 sm:min-w-[24rem]"
        >
          <div className="border-b border-zinc-800 px-3 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Schimbă vehiculul</p>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută nr., client, marcă, model…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 placeholder:text-zinc-600 focus:ring-2"
            />
            <p className="mt-2 text-[10px] text-zinc-600">
              Ctrl+K · {listItems.length} {listItems.length === 1 ? "vehicul" : "vehicule"}
            </p>
          </div>

          {!q && recentVehicles.length > 0 ? (
            <div className="border-b border-zinc-800 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Recente</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {recentVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => navigateTo(v.id)}
                    className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-0.5 font-mono text-[11px] text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    {v.registrationNumber}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="max-h-64 overflow-y-auto">
            {listItems.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500">Niciun vehicul găsit.</p>
            ) : (
              listItems.map((v, idx) => {
                const selected = v.id === currentId;
                const highlighted = idx === highlightIdx;
                const model = modelLabelFromOption(v);
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => navigateTo(v.id)}
                    className={`flex w-full items-center justify-between gap-3 border-t border-zinc-800/80 px-3 py-2.5 text-left first:border-t-0 ${
                      selected
                        ? "bg-emerald-950/35"
                        : highlighted
                          ? "bg-zinc-800/70"
                          : "hover:bg-zinc-900/80"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-sm font-semibold text-zinc-100">{v.registrationNumber}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-400">
                        {model}
                        <span className="mx-1.5 text-zinc-600">·</span>
                        {(v.odometerKm ?? 0).toLocaleString("ro-RO")} km
                        <span className="mx-1.5 text-zinc-600">·</span>
                        {v.clientId}
                      </span>
                    </span>
                    {selected ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-emerald-400/90">activ</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[10px] text-zinc-600">
            Enter = selectează · Esc = închide · ↑↓ navigare
          </div>
        </div>
      ) : null}
    </div>
  );
}
