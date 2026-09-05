"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FleetGlyphTooltip } from "@/components/fleet/FleetGlyphTooltip";
import {
  FleetDataTable,
  fleetTableClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { WorkOrderColumnPicker } from "@/components/fleet/work-orders/WorkOrderColumnPicker";
import { WorkOrderGlyphLegendPanel } from "@/components/fleet/work-orders/WorkOrderGlyphLegendPanel";
import { WorkOrderGridViewsPanel } from "@/components/fleet/work-orders/WorkOrderGridViewsPanel";
import {
  ServiceOrderTypeGlyph,
  TicketActionGlyph,
  TicketVehicleGlyph,
  WorkOrderEstimatedGlyph,
  WorkOrderPartnerGlyph,
  WorkOrderQuoteGlyph,
  WorkOrderStageGlyph,
  WorkOrderStatusGlyph,
  WorkOrderTicketGlyph,
} from "@/components/fleet/work-orders/WorkOrderListGlyphs";
import { formatDateRo } from "@/lib/datetime-local";
import {
  readWorkOrderGridLayout,
  type WorkOrderGridColumnKey,
  type WorkOrderGridLayout,
  visibleWorkOrderColumns,
} from "@/lib/work-order-grid-columns";
import { workOrderListTitleFull, workOrderListTitleShort } from "@/lib/work-order-list-title";
import { serviceOrderTypeLabel } from "@/lib/work-order-sheet";
import {
  formatMoneyCents,
  quoteStatusLabel,
  serviceCaseStageLabel,
  workOrderStatusLabel,
  type WorkOrderListRow,
} from "@/lib/work-orders-api";

const compactTdClass = "px-2 py-1 align-middle leading-tight";
const compactThClass = `${fleetThClass} px-2 py-1.5 text-[10px]`;

function formatRelative(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  items: WorkOrderListRow[];
  filterParams?: Record<string, string>;
  /** Base path for WO detail links (default /fleet/work-orders). */
  workOrdersBasePath?: string;
  /** Partner portal — hide fleet-only links (vehicles, tickets). */
  partnerView?: boolean;
};

export function WorkOrderDataGrid({
  items,
  filterParams = {},
  workOrdersBasePath = "/fleet/work-orders",
  partnerView = false,
}: Props) {
  const [layout, setLayout] = useState<WorkOrderGridLayout>(() => readWorkOrderGridLayout());
  const [showColumns, setShowColumns] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const columns = useMemo(() => visibleWorkOrderColumns(layout), [layout]);

  function renderCell(key: WorkOrderGridColumnKey, row: WorkOrderListRow) {
    const q = row.quoteSummary;
    const titleFull = workOrderListTitleFull(row.ticketSubject, row.title);
    const titleShort = workOrderListTitleShort(row.ticketSubject ?? row.title);

    switch (key) {
      case "number":
        return (
          <Link
            href={`${workOrdersBasePath}/${row.id}`}
            className="font-mono text-[11px] text-violet-300 hover:underline"
            title={row.title}
          >
            {row.displayNumber ?? row.id.slice(-6).toUpperCase()}
          </Link>
        );
      case "status":
        return (
          <FleetGlyphTooltip label={workOrderStatusLabel(row.status)}>
            <WorkOrderStatusGlyph status={row.status} />
          </FleetGlyphTooltip>
        );
      case "type":
        return (
          <FleetGlyphTooltip label={serviceOrderTypeLabel(row.serviceOrderType)}>
            <ServiceOrderTypeGlyph type={row.serviceOrderType} />
          </FleetGlyphTooltip>
        );
      case "title":
        return (
          <Link
            href={`${workOrdersBasePath}/${row.id}`}
            className="font-medium text-zinc-100 hover:text-white"
            title={titleFull}
          >
            {titleShort}
          </Link>
        );
      case "total":
        return (
          <span className="inline-flex items-center gap-1">
            {q.status ? (
              <FleetGlyphTooltip label={`Deviz: ${quoteStatusLabel(q.status)}`}>
                <WorkOrderQuoteGlyph status={q.status} />
              </FleetGlyphTooltip>
            ) : null}
            {q.totalGrossCents != null ? (
              <span className="font-mono text-[11px] text-zinc-200">
                {formatMoneyCents(q.totalGrossCents, q.currency ?? "RON")}
              </span>
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </span>
        );
      case "vehicle":
        return partnerView ? (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-300">
            <FleetGlyphTooltip label="Vehicul">
              <TicketVehicleGlyph />
            </FleetGlyphTooltip>
            {row.registrationNumber}
          </span>
        ) : (
          <Link
            href={`/fleet/vehicles/${row.vehicleId}`}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-300/90 hover:underline"
            title={row.registrationNumber}
          >
            <TicketVehicleGlyph />
            {row.registrationNumber}
          </Link>
        );
      case "client":
        return (
          <span className="text-zinc-300" title={row.clientLegalName}>
            {row.clientCode}
          </span>
        );
      case "partner":
        return row.supplierLegalName ? (
          <span className="inline-flex max-w-[7rem] items-center gap-1 truncate">
            <FleetGlyphTooltip label={row.supplierLegalName}>
              <WorkOrderPartnerGlyph />
            </FleetGlyphTooltip>
            <span className="truncate">{row.supplierLegalName}</span>
          </span>
        ) : (
          "—"
        );
      case "stage":
        return (
          <FleetGlyphTooltip label={`Etapă dosar: ${serviceCaseStageLabel(row.serviceCaseStage)}`}>
            <WorkOrderStageGlyph stage={row.serviceCaseStage} />
          </FleetGlyphTooltip>
        );
      case "estimated":
        return (
          <FleetGlyphTooltip
            label={
              row.estimatedRepairAt
                ? `Estimare finalizare: ${formatDateRo(row.estimatedRepairAt)}`
                : "Estimare finalizare necompletată"
            }
          >
            <span className="inline-flex items-center gap-1">
              <WorkOrderEstimatedGlyph set={Boolean(row.estimatedRepairAt)} />
              {row.estimatedRepairAt ? (
                <span className="hidden text-[10px] text-zinc-400 xl:inline">{formatDateRo(row.estimatedRepairAt)}</span>
              ) : null}
            </span>
          </FleetGlyphTooltip>
        );
      case "ticket":
        return row.sourceTicketId && row.ticketDisplayId ? (
          <FleetGlyphTooltip
            label={`Tichet #${row.ticketDisplayId}${row.ticketSubject ? ` — ${row.ticketSubject}` : ""}`}
          >
            {partnerView ? (
              <span className="inline-flex items-center">
                <WorkOrderTicketGlyph />
              </span>
            ) : (
              <Link href={`/fleet/tickets/${row.sourceTicketId}`} className="inline-flex items-center">
                <WorkOrderTicketGlyph />
              </Link>
            )}
          </FleetGlyphTooltip>
        ) : (
          "—"
        );
      case "updated":
        return (
          <span className="text-[10px] text-zinc-500" title={formatRelative(row.updatedAt)}>
            {formatRelative(row.updatedAt)}
          </span>
        );
      case "actions":
        return (
          <FleetGlyphTooltip label="Deschide fișă">
            <Link href={`${workOrdersBasePath}/${row.id}`} className="inline-flex items-center">
              <TicketActionGlyph action="open" />
            </Link>
          </FleetGlyphTooltip>
        );
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
        <WorkOrderGridViewsPanel currentParams={filterParams} />
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
      </div>

      {showColumns ? (
        <WorkOrderColumnPicker layout={layout} onChange={setLayout} onClose={() => setShowColumns(false)} />
      ) : null}
      {showLegend ? <WorkOrderGlyphLegendPanel onClose={() => setShowLegend(false)} /> : null}

      <FleetDataTable>
        <table className={`${fleetTableClass} text-[11px]`}>
          <thead className={fleetTheadClass}>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`${compactThClass} whitespace-nowrap`} style={{ minWidth: col.minWidth }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((row) => (
              <tr key={row.id} className="h-8 hover:bg-zinc-900/40">
                {columns.map((col) => (
                  <td key={col.key} className={`${compactTdClass} max-w-[200px] truncate`}>
                    {renderCell(col.key, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </FleetDataTable>
    </div>
  );
}
