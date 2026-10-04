"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeleteCostButton } from "@/components/fleet/DeleteCostButton";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { ListColumnPicker } from "@/components/fleet/ListColumnPicker";
import { IconEye, IconPencil, listGridIconBtnClass } from "@/components/fleet/list-grid-icons";
import { OpsAssetScopeBadge } from "@/components/fleet/OpsAssetScopeBadge";
import { useT } from "@/lib/i18n/useT";
import {
  COST_GRID_COLUMNS,
  defaultCostGridLayout,
  readCostGridLayout,
  type CostGridColumnKey,
  type CostGridLayout,
  visibleCostColumns,
  writeCostGridLayout,
} from "@/lib/cost-grid-columns";
import { formatRonFromCents } from "@/lib/money";

export type CostGridRow = {
  id: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  category: string;
  provider: string | null;
  amountCents: number;
  odometerKm: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  incurredOn: string;
  linkedDocumentId?: string | null;
  vehicleEquipmentLabel?: string | null;
};

type Props = {
  items: CostGridRow[];
  canWrite: boolean;
};

export function CostsDataGrid({ items, canWrite }: Props) {
  const tx = useT();
  const [layout, setLayout] = useState<CostGridLayout>(() => readCostGridLayout());
  const [showColumns, setShowColumns] = useState(false);
  const columns = useMemo(() => visibleCostColumns(layout), [layout]);
  const translatedColumns = useMemo(
    () => COST_GRID_COLUMNS.map((col) => ({ ...col, label: tx(`ops.grids.costs.columns.${col.key}`) })),
    [tx],
  );

  function persist(next: CostGridLayout) {
    setLayout(next);
    writeCostGridLayout(next);
  }

  function renderActions(row: CostGridRow) {
    return (
      <div className="inline-flex items-center justify-end gap-1">
        <Link
          href={`/fleet/costs/${row.id}`}
          className={`${listGridIconBtnClass} text-emerald-400/90 hover:text-emerald-300`}
          title={tx("ops.grids.actions.viewDetails")}
          aria-label={`${tx("ops.grids.actions.viewCost")} ${row.category}`}
        >
          <IconEye className="h-3.5 w-3.5" />
        </Link>
        {canWrite ? (
          <>
            <Link
              href={`/fleet/costs/${row.id}/edit`}
              className={listGridIconBtnClass}
              title={tx("ops.grids.actions.edit")}
              aria-label={`${tx("ops.grids.actions.edit")} ${row.category}`}
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Link>
            <DeleteCostButton entryId={row.id} label={row.category} variant="icon" />
          </>
        ) : null}
        {row.linkedDocumentId ? (
          <Link
            href={`/fleet/documents/${row.linkedDocumentId}`}
            className={`${listGridIconBtnClass} text-sky-400/90 hover:text-sky-300`}
            title={tx("ops.grids.costs.linkedDocument")}
            aria-label={tx("ops.grids.costs.linkedDocument")}
          >
            <span className="text-[10px] font-semibold">{tx("ops.grids.costs.docShort")}</span>
          </Link>
        ) : null}
      </div>
    );
  }

  function renderCell(key: CostGridColumnKey, row: CostGridRow) {
    switch (key) {
      case "primary":
        return (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-zinc-100">{row.category}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">{row.registrationNumber}</p>
          </div>
        );
      case "asset":
        return <OpsAssetScopeBadge equipmentLabel={row.vehicleEquipmentLabel} />;
      case "registration":
        return <span className="font-mono text-zinc-300">{row.registrationNumber}</span>;
      case "client":
        return (
          <span className="block truncate text-zinc-300" title={row.clientId}>
            {row.clientId}
          </span>
        );
      case "provider":
        return <span className="block truncate text-zinc-300">{row.provider?.trim() || "—"}</span>;
      case "date":
        return (
          <span className="font-mono tabular-nums text-zinc-300">
            {new Date(row.incurredOn).toLocaleDateString("ro-RO")}
          </span>
        );
      case "km":
        return (
          <span className="font-mono tabular-nums text-zinc-200">
            {row.odometerKm != null ? row.odometerKm.toLocaleString("ro-RO") : "—"}
          </span>
        );
      case "invoice":
        return (
          <span className="block truncate font-mono text-[11px] text-zinc-400" title={row.invoiceNumber ?? undefined}>
            {row.invoiceNumber?.trim() || "—"}
          </span>
        );
      case "invoiceDate":
        return (
          <span className="font-mono tabular-nums text-zinc-300">
            {row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString("ro-RO") : "—"}
          </span>
        );
      case "document":
        return row.invoiceAttachmentUrl ? (
          <a href={row.invoiceAttachmentUrl} download className="text-emerald-400 hover:underline">
            {tx("ops.grids.actions.download")}
          </a>
        ) : (
          <span className="text-zinc-600">—</span>
        );
      case "amount":
        return (
          <span className="font-mono tabular-nums text-zinc-100">{formatRonFromCents(row.amountCents)}</span>
        );
      case "actions":
        return renderActions(row);
      default:
        return null;
    }
  }

  const alignRight = (key: CostGridColumnKey) =>
    key === "actions" || key === "amount" || key === "km";

  const rowLineCell = layout.rowLines ? "border-b border-zinc-700/70" : "";
  const colLineCell = layout.colLines ? "border-r border-zinc-700/70 last:border-r-0" : "";
  const thBase = `bg-zinc-950 px-3 py-2 text-left ${
    layout.rowLines ? "border-b border-zinc-700" : "border-b border-zinc-800/50"
  }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
          <label className="inline-flex cursor-pointer items-center gap-2 hover:text-zinc-200">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
              checked={layout.rowLines}
              onChange={(e) => persist({ ...layout, rowLines: e.target.checked })}
            />
            {tx("ops.grids.controls.rowLines")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 hover:text-zinc-200">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
              checked={layout.colLines}
              onChange={(e) => persist({ ...layout, colLines: e.target.checked })}
            />
            {tx("ops.grids.controls.colLines")}
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowColumns((v) => !v)}
          className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
        >
          {showColumns ? tx("ops.grids.controls.closeColumns") : tx("ops.grids.controls.columns")}
        </button>
      </div>
      {showColumns ? (
        <ListColumnPicker
          title={tx("ops.grids.costs.columnPickerTitle")}
          columns={translatedColumns}
          layout={layout}
          onChange={persist}
          onReset={() => persist(defaultCostGridLayout())}
          onClose={() => setShowColumns(false)}
        />
      ) : null}

      <div className="space-y-3 md:hidden">
        {items.map((row) => (
          <article
            key={row.id}
            className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{row.category}</p>
                <p className="mt-0.5 font-mono text-xs text-zinc-400">{row.registrationNumber}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{row.clientId}</p>
                {row.provider ? <p className="mt-0.5 truncate text-xs text-zinc-500">{row.provider}</p> : null}
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-100">
                {formatRonFromCents(row.amountCents)}
              </span>
            </div>
            <p className="mt-3 font-mono text-xs tabular-nums text-zinc-400">
              {new Date(row.incurredOn).toLocaleDateString("ro-RO")}
              {row.odometerKm != null ? ` · ${row.odometerKm.toLocaleString("ro-RO")} km` : ""}
            </p>
            <div className="mt-2">
              <OpsAssetScopeBadge equipmentLabel={row.vehicleEquipmentLabel} />
            </div>
            <div className="mt-3 flex justify-end">{renderActions(row)}</div>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <FleetDataTable>
          <table className={`${fleetTableClass} table-fixed`}>
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={col.width ? { width: col.width } : undefined} />
              ))}
            </colgroup>
            <thead className={`${fleetTheadClass} tracking-wider`}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${thBase} ${colLineCell} ${alignRight(col.key) ? "text-right" : ""}`}
                  >
                    {col.key === "actions" ? (
                      <span className="sr-only">{tx(`ops.grids.costs.columns.${col.key}`)}</span>
                    ) : (
                      tx(`ops.grids.costs.columns.${col.key}`)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="bg-transparent transition-colors hover:bg-zinc-900/50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${fleetTdClass} align-middle ${rowLineCell} ${colLineCell} ${
                        alignRight(col.key) ? "text-right" : ""
                      } ${col.key === "primary" ? "py-2.5" : ""}`}
                    >
                      {renderCell(col.key, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </FleetDataTable>
      </div>
    </div>
  );
}
