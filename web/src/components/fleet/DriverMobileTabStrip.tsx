"use client";

/** Horizontal pill tabs for driver mobile — avoids desktop tab chrome. */
export function DriverMobileTabStrip({
  items,
  activeId,
  onSelect,
}: {
  items: Array<{ id: string; label: string }>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Secțiuni"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
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
  );
}
