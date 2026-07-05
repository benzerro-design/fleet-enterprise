import { TicketActionGlyph, TicketVehicleGlyph } from "@/components/fleet/tickets/TicketListGlyphs";
import type { ServiceOrderType, WorkOrderStatus } from "@/lib/work-orders-api";
import { workOrderStatusLabel } from "@/lib/work-orders-api";
import { serviceOrderTypeLabel } from "@/lib/work-order-sheet";

type GlyphProps = { className?: string };

function Svg({ children, className }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 ${className ?? ""}`} aria-hidden>
      {children}
    </svg>
  );
}

export function WorkOrderStatusGlyph({ status }: { status: WorkOrderStatus | string }) {
  switch (status) {
    case "draft":
      return (
        <Svg className="text-zinc-500">
          <rect x="4" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1" />
        </Svg>
      );
    case "sent":
      return (
        <Svg className="text-sky-400">
          <path d="M3 8 L8 4 L13 8 L8 12 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <line x1="8" y1="8" x2="8" y2="13" stroke="currentColor" strokeWidth="1.2" />
        </Svg>
      );
    case "in_progress":
      return (
        <Svg className="text-emerald-400">
          <circle cx="8" cy="8" r="5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.4" />
        </Svg>
      );
    case "waiting_parts":
      return (
        <Svg className="text-amber-400">
          <rect x="3" y="5" width="10" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <line x1="6" y1="3" x2="6" y2="5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="10" y1="3" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" />
        </Svg>
      );
    case "done":
      return (
        <Svg className="text-zinc-400">
          <path d="M4 8 L7 11 L12 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </Svg>
      );
    case "cancelled":
      return (
        <Svg className="text-rose-400">
          <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" />
          <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    default:
      return (
        <Svg className="text-zinc-600">
          <circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </Svg>
      );
  }
}

export function ServiceOrderTypeGlyph({ type }: { type: ServiceOrderType | string }) {
  switch (type) {
    case "M":
      return (
        <Svg className="text-violet-300">
          <path d="M6 3 L10 3 L11 6 L14 8 L11 10 L10 13 L6 13 L5 10 L2 8 L5 6 Z" fill="none" stroke="currentColor" strokeWidth="1" />
        </Svg>
      );
    case "E":
      return (
        <Svg className="text-yellow-300">
          <path d="M8 2 L10 6 L14 6 L11 9 L12 13 L8 11 L4 13 L5 9 L2 6 L6 6 Z" fill="none" stroke="currentColor" strokeWidth="0.9" />
        </Svg>
      );
    case "D":
      return (
        <Svg className="text-orange-300">
          <rect x="2" y="5" width="12" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4 12 L7 8 L10 10 L12 6" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </Svg>
      );
    case "TV":
      return (
        <Svg className="text-sky-300">
          <path d="M2 11 H14 M4 11 V7 H12 V11 M6 7 V4 H10 V7" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </Svg>
      );
    default:
      return (
        <Svg className="text-zinc-500">
          <rect x="4" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </Svg>
      );
  }
}

export function WorkOrderStageGlyph({ stage }: { stage: string }) {
  if (stage === "in_service") {
    return (
      <Svg className="text-emerald-400">
        <rect x="2" y="4" width="12" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 8 H11" stroke="currentColor" strokeWidth="1.2" />
      </Svg>
    );
  }
  if (stage === "approval") {
    return (
      <Svg className="text-amber-300">
        <path d="M8 2 L9.5 6 H14 L10.5 8.5 L12 13 L8 10.5 L4 13 L5.5 8.5 L2 6 H6.5 Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
      </Svg>
    );
  }
  if (stage === "invoiced" || stage === "cost") {
    return (
      <Svg className="text-emerald-500">
        <rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 8 L7 10 L11 6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </Svg>
    );
  }
  if (stage === "quote") {
    return (
      <Svg className="text-sky-300">
        <rect x="4" y="2" width="8" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1="6" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="6" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1" />
      </Svg>
    );
  }
  return (
    <Svg className="text-zinc-500">
      <circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export function WorkOrderQuoteGlyph({ status }: { status: string | null | undefined }) {
  if (status === "submitted") {
    return (
      <Svg className="text-amber-300">
        <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <line x1="8" y1="5" x2="8" y2="8" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="10.5" r="0.8" fill="currentColor" />
      </Svg>
    );
  }
  if (status === "approved") {
    return (
      <Svg className="text-emerald-400">
        <path d="M4 8 L7 11 L12 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </Svg>
    );
  }
  return null;
}

export function WorkOrderEstimatedGlyph({ set }: { set: boolean }) {
  if (set) {
    return (
      <Svg className="text-zinc-400">
        <rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1="3" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="6" y1="2" x2="6" y2="4" stroke="currentColor" strokeWidth="1" />
        <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1" />
      </Svg>
    );
  }
  return (
    <Svg className="text-amber-400">
      <rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
    </Svg>
  );
}

export function WorkOrderPartnerGlyph() {
  return (
    <Svg className="text-zinc-500">
      <path d="M3 13 V5 L8 2 L13 5 V13 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6" y="8" width="4" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
    </Svg>
  );
}

export function WorkOrderTicketGlyph() {
  return (
    <Svg className="text-emerald-400">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line x1="6" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1" />
      <line x1="6" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1" />
    </Svg>
  );
}

export { TicketVehicleGlyph, TicketActionGlyph };

export const WORK_ORDER_GLYPH_LEGEND = [
  {
    group: "Status WO",
    items: (["draft", "sent", "in_progress", "waiting_parts", "done"] as const).map((s) => ({
      label: workOrderStatusLabel(s),
      glyph: <WorkOrderStatusGlyph status={s} />,
    })),
  },
  {
    group: "Tip comandă",
    items: (["M", "E", "D", "TV"] as const).map((t) => ({
      label: serviceOrderTypeLabel(t),
      glyph: <ServiceOrderTypeGlyph type={t} />,
    })),
  },
  {
    group: "Etapă / deviz",
    items: [
      { label: "In service", glyph: <WorkOrderStageGlyph stage="in_service" /> },
      { label: "Aprobare", glyph: <WorkOrderStageGlyph stage="approval" /> },
      { label: "Deviz", glyph: <WorkOrderStageGlyph stage="quote" /> },
      { label: "Deviz trimis", glyph: <WorkOrderQuoteGlyph status="submitted" /> },
      { label: "Deviz aprobat", glyph: <WorkOrderQuoteGlyph status="approved" /> },
    ],
  },
  {
    group: "Altele",
    items: [
      { label: "Vehicul", glyph: <TicketVehicleGlyph /> },
      { label: "Tichet CRM", glyph: <WorkOrderTicketGlyph /> },
      { label: "Estimare setată", glyph: <WorkOrderEstimatedGlyph set /> },
      { label: "Estimare lipsă", glyph: <WorkOrderEstimatedGlyph set={false} /> },
      { label: "Deschide fișă", glyph: <TicketActionGlyph action="open" /> },
    ],
  },
] as const;
