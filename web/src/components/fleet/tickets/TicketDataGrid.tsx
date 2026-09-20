"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  resolveColumnWidthPx,
  ticketColumnDef,
  type TicketGridColumnKey,
  type TicketGridLayout,
  visibleTicketColumns,
  withColumnWidth,
  writeTicketGridLayout,
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
  /** Admin L* sau manager cu setare pe client. Șofer: false. */
  enableBulk?: boolean;
  exportHref?: string;
  filterParams?: Record<string, string>;
};

export function TicketDataGrid({
  items,
  canWrite,
  canPatch = false,
  enableBulk = false,
  exportHref,
  filterParams = {},
}: Props) {
  const [layout, setLayout] = useState<TicketGridLayout>(() => readTicketGridLayout());
  const [showColumns, setShowColumns] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [resizingKey, setResizingKey] = useState<TicketGridColumnKey | null>(null);
  const layoutRef = useRef(layout);
  const columns = useMemo(() => visibleTicketColumns(layout), [layout]);
  const hasFilters = Object.keys(filterParams).length > 0;
  const allSelected = enableBulk && items.length > 0 && items.every((r) => selected.has(r.id));

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const persistLayout = useCallback((next: TicketGridLayout) => {
    setLayout(next);
    writeTicketGridLayout(next);
  }, []);

  const startResize = useCallback(
    (key: TicketGridColumnKey, clientX: number) => {
      const def = ticketColumnDef(key);
      if (!def) return;
      const startW = resolveColumnWidthPx(layoutRef.current, key) ?? def.defaultWidth;
      setResizingKey(key);

      function onMove(ev: MouseEvent) {
        const next = withColumnWidth(layoutRef.current, key, startW + (ev.clientX - clientX));
        layoutRef.current = next;
        setLayout(next);
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        setResizingKey(null);
        writeTicketGridLayout(layoutRef.current);
      }

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [],
  );

  function resetColumnWidth(key: TicketGridColumnKey) {
    const widths = { ...layoutRef.current.widths };
    delete widths[key];
    persistLayout({ ...layoutRef.current, widths });
  }

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
          <span className="inline-flex items-center gap-1.5">
            {enableBulk ? (
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onChange={() => toggleOne(row.id)}
                aria-label={`Selectează #${row.displayId}`}
                className="rounded border-zinc-600"
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
            <Link href={`/fleet/tickets/${row.id}`} className="font-mono text-emerald-400 hover:underline">
              #{row.displayId}
            </Link>
          </span>
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
          <Link
            href={`/fleet/tickets/${row.id}`}
            className="block truncate font-medium text-zinc-100 hover:text-white"
            title={row.subject}
          >
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
          <span className="inline-flex max-w-full items-center gap-1.5">
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
          <span className="inline-flex max-w-full items-center gap-1.5 text-zinc-400">
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

      {enableBulk && selected.size > 0 ? (
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
        <TicketColumnPicker layout={layout} onChange={persistLayout} onClose={() => setShowColumns(false)} />
      ) : null}
      {showLegend ? <TicketGlyphLegendPanel onClose={() => setShowLegend(false)} /> : null}

      <FleetDataTable>
        <table className={`${fleetTableClass} w-full table-fixed text-xs ${resizingKey ? "select-none" : ""}`}>
          <colgroup>
            {columns.map((col) => {
              const px = resolveColumnWidthPx(layout, col.key);
              return <col key={col.key} style={px != null ? { width: px } : undefined} />;
            })}
          </colgroup>
          <thead className={fleetTheadClass}>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`${fleetThClass} relative whitespace-nowrap`}>
                  {col.key === "id" && enableBulk ? (
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Selectează toate pe pagină"
                        className="rounded border-zinc-600"
                      />
                      <span>#</span>
                    </span>
                  ) : (
                    col.label
                  )}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Redimensionează coloana ${col.label || col.key}`}
                    title="Trage pentru lățime · dublu-click = reset"
                    className={`absolute top-0 right-0 z-30 h-full w-1.5 cursor-col-resize hover:bg-emerald-500/40 ${
                      resizingKey === col.key ? "bg-emerald-500/50" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startResize(col.key, e.clientX);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      resetColumnWidth(col.key);
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((row) => {
              const isSel = enableBulk && selected.has(row.id);
              return (
                <tr key={row.id} className={isSel ? "bg-emerald-950/20 hover:bg-emerald-950/30" : "hover:bg-zinc-900/40"}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${fleetTdClass} ${
                        col.key === "subject" ? "overflow-hidden" : "truncate"
                      }`}
                    >
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
