"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { TicketColumnPicker } from "@/components/fleet/tickets/TicketColumnPicker";
import { TicketGlyphLegendPanel } from "@/components/fleet/tickets/TicketGlyphLegendPanel";
import { TicketGridViewsPanel } from "@/components/fleet/tickets/TicketGridViewsPanel";
import { TicketInlinePatchCell } from "@/components/fleet/tickets/TicketInlinePatchCell";
import {
  FleetAvatar,
  TicketPriorityGlyph,
  TicketRoutingGlyph,
  TicketStatusGlyph,
  TicketTypeGlyph,
  TicketVehicleGlyph,
} from "@/components/fleet/tickets/TicketListGlyphs";
import { TicketRowActions } from "@/components/fleet/tickets/TicketRowActions";
import { TicketStatusBadge } from "@/components/fleet/TicketStatusBadge";
import { FleetGlyphTooltip } from "@/components/fleet/FleetGlyphTooltip";
import {
  readTicketGridLayout,
  type TicketGridColumnKey,
  type TicketGridLayout,
  visibleTicketColumns,
} from "@/lib/ticket-grid-columns";
import {
  ticketPriorityLabel,
  ticketRoutingLabel,
  ticketStatusLabel,
  ticketTypeLabel,
  type TicketRecord,
} from "@/lib/tickets-api";

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${Math.max(1, h)}h`;
  const d = Math.floor(h / 24);
  return `${d}z`;
}

function formatRelative(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  items: TicketRecord[];
  canWrite: boolean;
  canPatch?: boolean;
  exportHref?: string;
  filterParams?: Record<string, string>;
};

export function TicketDataGrid({ items, canWrite, canPatch = false, exportHref, filterParams = {} }: Props) {
  const [layout, setLayout] = useState<TicketGridLayout>(() => readTicketGridLayout());
  const [showColumns, setShowColumns] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const columns = useMemo(() => visibleTicketColumns(layout), [layout]);

  function renderCell(key: TicketGridColumnKey, row: TicketRecord) {
    switch (key) {
      case "pin":
        return <span className="text-zinc-600">◎</span>;
      case "id":
        return (
          <Link href={`/fleet/tickets/${row.id}`} className="font-mono text-emerald-400 hover:underline">
            #{row.displayId}
          </Link>
        );
      case "status":
        return canPatch ? (
          <TicketInlinePatchCell ticket={row} field="status" />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <FleetGlyphTooltip label={ticketStatusLabel(row.status)}>
              <TicketStatusGlyph status={row.status} />
            </FleetGlyphTooltip>
            <TicketStatusBadge status={row.status} compact />
          </span>
        );
      case "priority":
        return canPatch ? (
          <TicketInlinePatchCell ticket={row} field="priority" />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <FleetGlyphTooltip label={ticketPriorityLabel(row.priority)}>
              <TicketPriorityGlyph priority={row.priority} />
            </FleetGlyphTooltip>
            <span className="text-xs">{ticketPriorityLabel(row.priority)}</span>
          </span>
        );
      case "type":
        return (
          <span className="inline-flex items-center gap-1.5">
            <FleetGlyphTooltip label={ticketTypeLabel(row.ticketType)}>
              <TicketTypeGlyph type={row.ticketType} />
            </FleetGlyphTooltip>
            <span>{ticketTypeLabel(row.ticketType)}</span>
          </span>
        );
      case "subject":
        return (
          <Link href={`/fleet/tickets/${row.id}`} className="font-medium text-zinc-100 hover:text-white">
            {row.subject}
          </Link>
        );
      case "client":
        return row.clientCode;
      case "vehicle":
        return (
          <span className="inline-flex items-center gap-1.5 font-mono text-zinc-300">
            <FleetGlyphTooltip label="Vehicul">
              <TicketVehicleGlyph />
            </FleetGlyphTooltip>
            {row.registrationNumber ?? "—"}
          </span>
        );
      case "driver":
        return row.driverFullName ? (
          <span className="inline-flex items-center gap-1.5">
            <FleetAvatar name={row.driverFullName} size={18} />
            <span className="truncate">{row.driverFullName}</span>
          </span>
        ) : (
          "—"
        );
      case "routing":
        return (
          <span className="inline-flex items-center gap-1">
            <FleetGlyphTooltip label={ticketRoutingLabel(row.routingLevel)}>
              <TicketRoutingGlyph level={row.routingLevel} />
            </FleetGlyphTooltip>
            <span className="text-xs">{ticketRoutingLabel(row.routingLevel)}</span>
          </span>
        );
      case "owner":
        return row.ownerEmail ? (
          <span className="inline-flex items-center gap-1.5 text-zinc-400">
            <FleetAvatar name={row.ownerEmail.split("@")[0]} size={18} />
            <span className="truncate text-xs">{row.ownerEmail.split("@")[0]}</span>
          </span>
        ) : (
          "—"
        );
      case "age":
        return <span className="font-mono text-xs">{formatAge(row.createdAt)}</span>;
      case "updated":
        return <span className="text-xs text-zinc-500">{formatRelative(row.updatedAt)}</span>;
      case "created":
        return <span className="text-xs text-zinc-500">{formatRelative(row.createdAt)}</span>;
      case "resolved":
        return row.resolvedAt ? <span className="text-xs text-zinc-500">{formatRelative(row.resolvedAt)}</span> : "—";
      case "queue":
        return <span className="font-mono text-[10px] text-zinc-500">{row.assignedQueue}</span>;
      case "km":
        return (
          <span className="font-mono text-xs text-sky-300">
            {row.vehicleOdometerKm != null ? row.vehicleOdometerKm.toLocaleString("ro-RO") : "—"}
          </span>
        );
      case "actions":
        return <TicketRowActions ticket={row} canWrite={canWrite} compact />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowColumns((v) => !v);
            setShowLegend(false);
          }}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Coloane…
        </button>
        <TicketGridViewsPanel currentParams={filterParams} />
        <button
          type="button"
          onClick={() => {
            setShowLegend((v) => !v);
            setShowColumns(false);
          }}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Legendă iconițe
        </button>
        {exportHref ? (
          <a
            href={exportHref}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
          >
            Export CSV
          </a>
        ) : null}
      </div>

      {showColumns ? (
        <TicketColumnPicker layout={layout} onChange={setLayout} onClose={() => setShowColumns(false)} />
      ) : null}
      {showLegend ? <TicketGlyphLegendPanel onClose={() => setShowLegend(false)} /> : null}

      <FleetDataTable>
        <div className="fleet-scroll-pane overflow-auto">
          <table className={`${fleetTableClass} text-xs`}>
            <thead className={fleetTheadClass}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${fleetThClass} whitespace-nowrap`}
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-900/40">
                  {columns.map((col) => (
                    <td key={col.key} className={`${fleetTdClass} max-w-[280px] truncate`}>
                      {renderCell(col.key, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FleetDataTable>
    </div>
  );
}
