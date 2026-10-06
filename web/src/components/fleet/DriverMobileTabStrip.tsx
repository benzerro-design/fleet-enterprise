"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      {dir === "left" ? (
        <path
          fillRule="evenodd"
          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      )}
    </svg>
  );
}

/** Horizontal pill tabs for driver mobile — arrows hint when more tabs exist. */
export function DriverMobileTabStrip({
  items,
  activeId,
  onSelect,
}: {
  items: Array<{ id: string; label: string }>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [items, activeId, updateArrows]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>("[data-active-tab='1']");
    active?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    window.setTimeout(updateArrows, 50);
  }, [activeId, updateArrows]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.55), behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        aria-label="Taburi anterioare"
        disabled={!canLeft}
        onClick={() => scrollByDir(-1)}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full touch-manipulation transition-opacity ${
          canLeft ? "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800" : "pointer-events-none text-zinc-700 opacity-30"
        }`}
      >
        <Chevron dir="left" />
      </button>
      <nav
        ref={scrollerRef}
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Secțiuni"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              data-active-tab={active ? "1" : undefined}
              onClick={() => onSelect(item.id)}
              className={`inline-flex min-h-[40px] shrink-0 items-center rounded-full px-4 text-sm font-medium touch-manipulation ${
                active ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        aria-label="Taburi următoare"
        disabled={!canRight}
        onClick={() => scrollByDir(1)}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full touch-manipulation transition-opacity ${
          canRight ? "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800" : "pointer-events-none text-zinc-700 opacity-30"
        }`}
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}
