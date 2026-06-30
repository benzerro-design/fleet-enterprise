"use client";

import { TICKET_GLYPH_LEGEND } from "@/components/fleet/tickets/TicketListGlyphs";

type Props = { onClose: () => void };

export function TicketGlyphLegendPanel({ onClose }: Props) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100">Legendă iconițe</h3>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">
          Închide
        </button>
      </div>
      <div className="grid max-h-80 gap-4 overflow-y-auto sm:grid-cols-2">
        {TICKET_GLYPH_LEGEND.map((section) => (
          <div key={section.group}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">{section.group}</p>
            <ul className="space-y-1.5">
              {section.items.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-xs text-zinc-300">
                  {item.glyph}
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
