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
import { FleetListEmptyState } from "@/components/fleet/FleetListEmptyState";
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const columns = useMemo(() => visibleTicketColumns(layout), [layout]);
  const hasFilters = Object.keys(filterParams).length > 0;
  const allSelected = items.length > 0 && items.every((r) => selected.has(r.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openSelected() {
    const ids = items.filter((r) => selected.has(r.id)).map((r) => r.id).slice(0, 5);
    for (const id of ids) {
      window.open(`/fleet/tickets/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  async function copySelectedIds() {
    const rows = items.filter((r) => selected.has(r.id));
    const text = rows.map((r) => `#${r.displayId}`).join(", ");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

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
          <FleetGlyphTooltip label={ticketStatusLabel(row.status)}>
            <TicketStatusGlyph status={row.status} />
          </FleetGlyphTooltip>
        );
      case "priority":
        return canPatch ? (
          <TicketInlinePatchCell ticket={row} field="priority" />
        ) : (
          <FleetGlyphTooltip label={ticketPriorityLabel(row.priority)}>
            <TicketPriorityGlyph priority={row.priority} />
          </FleetGlyphTooltip>
        );
      case "type":
        return (
          <FleetGlyphTooltip label={ticketTypeLabel(row.ticketType)}>
            <TicketTypeGlyph type={row.ticketType} />
          </FleetGlyphTooltip>
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
          <FleetGlyphTooltip label={ticketRoutingLabel(row.routingLevel)}>
            <TicketRoutingGlyph level={row.routingLevel} />
          </FleetGlyphTooltip>
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

  if (items.length === 0) {
    return (
      <FleetListEmptyState
        title={hasFilters ? "Niciun tichet pentru filtrele curente" : "Niciun tichet încă"}
        description={
          hasFilters
            ? "Schimbă sau resetează filtrele ca să vezi alte rezultate."
            : "Creează o solicitare nouă sau așteaptă primul tichet din inbox."
        }
        hasFilters={hasFilters}
        clearFiltersHref="/fleet/tickets"
        primaryAction={canWrite ? { label: "Solicitare nouă", href: "/fleet/tickets/new" } : undefined}
      />
    );
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

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100 backdrop-blur">
          <span className="font-medium">{selected.size} selectate</span>
          <button
            type="button"
            onClick={openSelected}
            className="rounded-md border border-emerald-700/60 px-2.5 py-1 hover:bg-emerald-900/50"
          >
            Deschide (max 5)
          </button>
          <button
            type="button"
            onClick={() => void copySelectedIds()}
            className="rounded-md border border-emerald-700/60 px-2.5 py-1 hover:bg-emerald-900/50"
          >
            Copiază ID-uri
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-emerald-400/80 hover:underline">
            Debifează
          </button>
        </div>
      ) : null}

      {showColumns ? (
        <TicketColumnPicker layout={layout} onChange={setLayout} onClose={() => setShowColumns(false)} />
      ) : null}
      {showLegend ? <TicketGlyphLegendPanel onClose={() => setShowLegend(false)} /> : null}

      <FleetDataTable>
        <table className={`${fleetTableClass} text-xs`}>
          <thead className={fleetTheadClass}>
            <tr>
              <th className={`${fleetThClass} w-8`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selectează toate pe pagină"
                  className="rounded border-zinc-600"
                />
              </th>
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
            {items.map((row) => {
              const isSel = selected.has(row.id);
              return (
                <tr key={row.id} className={isSel ? "bg-emerald-950/20 hover:bg-emerald-950/30" : "hover:bg-zinc-900/40"}>
                  <td className={`${fleetTdClass} w-8`}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Selectează #${row.displayId}`}
                      className="rounded border-zinc-600"
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className={`${fleetTdClass} max-w-[280px] truncate`}>
                      {renderCell(col.key, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </FleetDataTable>
    </div>
  );
}
