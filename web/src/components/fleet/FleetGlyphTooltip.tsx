"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Tooltip pe hover pentru iconițe din grile.
 * Portal + position:fixed — nu e tăiat de overflow-x al tabelului / sticky thead.
 */
export function FleetGlyphTooltip({ label, children, className }: Props) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      top: r.top,
      left: r.left + r.width / 2,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  return (
    <span
      ref={anchorRef}
      className={`inline-flex items-center ${className ?? ""}`}
      onMouseEnter={() => {
        setOpen(true);
        updatePosition();
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        setOpen(true);
        updatePosition();
      }}
      onBlur={() => setOpen(false)}
    >
      {children}
      {mounted && open && coords
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[200] max-w-[14rem] -translate-x-1/2 -translate-y-full whitespace-normal rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-center text-[10px] leading-snug text-zinc-100 shadow-lg"
              style={{ top: coords.top - 6, left: coords.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
