"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FleetCommandItem = {
  id: string;
  label: string;
  href: string;
  group?: string;
  keywords?: string;
};

type Props = {
  items: FleetCommandItem[];
};

export const FLEET_OPEN_COMMAND_PALETTE = "fleet:open-command-palette";

/** Deschide paleta din top bar / search stub (Ctrl/Cmd+K rămâne). */
export function openFleetCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FLEET_OPEN_COMMAND_PALETTE));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function FleetCommandPalette({ items }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setQuery("");
      setHighlight(0);
    }
    window.addEventListener(FLEET_OPEN_COMMAND_PALETTE, onOpen);
    return () => window.removeEventListener(FLEET_OPEN_COMMAND_PALETTE, onOpen);
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter((item) => {
      const hay = normalize(`${item.label} ${item.group ?? ""} ${item.keywords ?? ""} ${item.href}`);
      return hay.includes(q);
    });
  }, [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }, []);

  const go = useCallback(
    (item: FleetCommandItem) => {
      close();
      router.push(item.href);
    },
    [close, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      setOpen((v) => !v);
      setQuery("");
      setHighlight(0);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered[highlight]) {
        e.preventDefault();
        go(filtered[highlight]);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, filtered, highlight, close, go]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] print:hidden" role="dialog" aria-modal="true" aria-label="Căutare rapidă">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Închide" onClick={close} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="border-b border-zinc-800 px-3 py-2.5">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mergi la… (ex. programator, tichete)"
            className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            autoComplete="off"
          />
        </div>
        <ul className="max-h-[min(50vh,20rem)] overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-zinc-500">Niciun rezultat</li>
          ) : (
            filtered.map((item, idx) => {
              const active = idx === highlight;
              return (
                <li key={item.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                      active ? "bg-emerald-950/50 text-emerald-100" : "text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium">{item.label}</span>
                    {item.group ? <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-600">{item.group}</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <p className="border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-600">
          ↑↓ navighează · Enter deschide · Esc închide · Ctrl/Cmd+K
        </p>
      </div>
    </div>,
    document.body,
  );
}
