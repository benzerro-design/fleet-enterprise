import type { TicketPriority, TicketRoutingLevel, TicketStatus, TicketType } from "@/lib/tickets-api";

type GlyphProps = { className?: string };

export function FleetAvatar({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 font-semibold text-zinc-300 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
      title={name}
    >
      {initials || "?"}
    </span>
  );
}

function Svg({ children, className }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 ${className ?? ""}`} aria-hidden>
      {children}
    </svg>
  );
}

export function TicketStatusGlyph({ status }: { status: TicketStatus }) {
  if (status === "open") {
    return (
      <Svg className="text-emerald-400">
        <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      </Svg>
    );
  }
  if (status === "in_progress") {
    return (
      <Svg className="text-sky-400">
        <circle cx="8" cy="8" r="5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      </Svg>
    );
  }
  if (status === "resolved") {
    return (
      <Svg className="text-emerald-500">
        <path d="M4 8 L7 11 L12 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </Svg>
    );
  }
  return (
    <Svg className="text-zinc-500">
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}

export function TicketPriorityGlyph({ priority }: { priority: TicketPriority }) {
  if (priority === "urgent") {
    return (
      <Svg className="text-orange-400">
        <path d="M8 2 L14 13 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <line x1="8" y1="6" x2="8" y2="9" stroke="currentColor" strokeWidth="1.3" />
      </Svg>
    );
  }
  if (priority === "high") {
    return (
      <Svg className="text-amber-400">
        <path d="M8 3 L13 12 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </Svg>
    );
  }
  return (
    <Svg className="text-zinc-600">
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </Svg>
  );
}

export function TicketTypeGlyph({ type }: { type: TicketType }) {
  if (type === "damage") {
    return (
      <Svg className="text-orange-300">
        <rect x="2" y="5" width="12" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 12 L7 8 L10 10 L12 6" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </Svg>
    );
  }
  if (type === "itp") {
    return (
      <Svg className="text-violet-300">
        <rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
      </Svg>
    );
  }
  if (type === "maintenance") {
    return (
      <Svg className="text-zinc-400">
        <path d="M6 3 L10 3 L11 6 L14 8 L11 10 L10 13 L6 13 L5 10 L2 8 L5 6 Z" fill="none" stroke="currentColor" strokeWidth="1" />
      </Svg>
    );
  }
  if (type === "transport") {
    return (
      <Svg className="text-sky-300">
        <path d="M3 11 L8 4 L13 11" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="11" r="1.5" fill="currentColor" />
      </Svg>
    );
  }
  return (
    <Svg className="text-zinc-500">
      <rect x="4" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export function TicketRoutingGlyph({ level }: { level: TicketRoutingLevel }) {
  if (level === "L_STAR") {
    return (
      <Svg className="text-amber-300">
        <path d="M8 2 L9.8 6.2 L14.4 6.6 L11 9.4 L12 14 L8 11.6 L4 14 L5 9.4 L1.6 6.6 L6.2 6.2 Z" fill="none" stroke="currentColor" strokeWidth="0.9" />
      </Svg>
    );
  }
  if (level === "L0") {
    return (
      <Svg className="text-zinc-400">
        <circle cx="8" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 13 C4 10 6 9 8 9 C10 9 12 10 12 13" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </Svg>
    );
  }
  return (
    <Svg className="text-blue-300">
      <rect x="4" y="2" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export function TicketVehicleGlyph() {
  return (
    <Svg className="text-zinc-400">
      <rect x="1" y="6" width="9" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 8 H13 L14 11 H10 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </Svg>
  );
}

export function TicketActionGlyph({ action }: { action: "claim" | "open" | "route" | "transform" | "resolve" }) {
  if (action === "claim") {
    return (
      <Svg className="text-sky-400">
        <path d="M4 8 L7 11 L12 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </Svg>
    );
  }
  if (action === "open") {
    return (
      <Svg className="text-emerald-400">
        <path d="M6 3 H3 V13 H13 V10 M9 2 H14 V7 M14 2 L7 9" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </Svg>
    );
  }
  if (action === "route") {
    return (
      <Svg className="text-purple-400">
        <path d="M3 12 V6 M3 6 H8 M8 6 V3 M8 3 H13" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </Svg>
    );
  }
  if (action === "transform") {
    return (
      <Svg className="text-violet-400">
        <path d="M6 10 L10 6 M10 6 H7 M10 6 V9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </Svg>
    );
  }
  return (
    <Svg className="text-emerald-500">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 8 L7.5 10 L10.5 6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export const TICKET_GLYPH_LEGEND = [
  { group: "Status", items: [
    { label: "Deschis", glyph: <TicketStatusGlyph status="open" /> },
    { label: "În lucru", glyph: <TicketStatusGlyph status="in_progress" /> },
    { label: "Rezolvat", glyph: <TicketStatusGlyph status="resolved" /> },
  ]},
  { group: "Prioritate", items: [
    { label: "Urgentă", glyph: <TicketPriorityGlyph priority="urgent" /> },
    { label: "Ridicată", glyph: <TicketPriorityGlyph priority="high" /> },
  ]},
  { group: "Tip", items: [
    { label: "Daună", glyph: <TicketTypeGlyph type="damage" /> },
    { label: "ITP", glyph: <TicketTypeGlyph type="itp" /> },
    { label: "Mentenanță", glyph: <TicketTypeGlyph type="maintenance" /> },
    { label: "Transport", glyph: <TicketTypeGlyph type="transport" /> },
  ]},
  { group: "Acțiuni rând", items: [
    { label: "Preluare", glyph: <TicketActionGlyph action="claim" /> },
    { label: "Deschide", glyph: <TicketActionGlyph action="open" /> },
    { label: "Rutare", glyph: <TicketActionGlyph action="route" /> },
    { label: "Transformă", glyph: <TicketActionGlyph action="transform" /> },
    { label: "Rezolvă", glyph: <TicketActionGlyph action="resolve" /> },
  ]},
] as const;
