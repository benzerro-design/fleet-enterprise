"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeleteTripButton } from "@/components/fleet/DeleteTripButton";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { ListColumnPicker } from "@/components/fleet/ListColumnPicker";
import { IconEye, IconPencil, listGridIconBtnClass } from "@/components/fleet/list-grid-icons";
import { formatDateTimeRo } from "@/lib/datetime-local";
import {
  defaultTripGridLayout,
  readTripGridLayout,
  TRIP_GRID_COLUMNS,
  type TripGridColumnKey,
  type TripGridLayout,
  visibleTripColumns,
  writeTripGridLayout,
} from "@/lib/trip-grid-columns";

export type TripGridRow = {
  id: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  reference: string | null;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
  driverId: string | null;
  driverName: string | null;
};

type Props = {
  items: TripGridRow[];
  canWrite: boolean;
};

function tripTitle(row: TripGridRow): string {
  if (row.reference?.trim()) return row.reference.trim();
  const route = [row.originLabel, row.destLabel].filter((x) => x?.trim()).join(" → ");
  return route || "Cursă";
}

function tripSubtitle(row: TripGridRow): string {
  const route = [row.originLabel, row.destLabel].filter((x) => x?.trim()).join(" → ");
  if (row.reference?.trim() && route) return `${row.registrationNumber} · ${route}`;
  return row.registrationNumber;
}

function statusClass(open: boolean): string {
  return open
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export function TripsDataGrid({ items, canWrite }: Props) {
  const [layout, setLayout] = useState<TripGridLayout>(() => readTripGridLayout());
  const [showColumns, setShowColumns] = useState(false);
  const columns = useMemo(() => visibleTripColumns(layout), [layout]);

  function persist(next: TripGridLayout) {
    setLayout(next);
    writeTripGridLayout(next);
  }

  function renderActions(row: TripGridRow) {
    return (
      <div className="inline-flex items-center justify-end gap-1">
        <Link
          href={`/fleet/trips/${row.id}`}
          className={`${listGridIconBtnClass} text-emerald-400/90 hover:text-emerald-300`}
          title="Vezi detaliu"
          aria-label={`Vezi cursa ${tripTitle(row)}`}
        >
          <IconEye className="h-3.5 w-3.5" />
        </Link>
        {canWrite ? (
          <>
            <Link
              href={`/fleet/trips/${row.id}/edit`}
              className={listGridIconBtnClass}
              title="Editare"
              aria-label={`Editează ${tripTitle(row)}`}
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Link>
            <DeleteTripButton tripId={row.id} label={row.reference ?? row.id} variant="icon" />
          </>
        ) : null}
      </div>
    );
  }

  function renderCell(key: TripGridColumnKey, row: TripGridRow) {
    const open = !row.endedAt;
    switch (key) {
      case "primary":
        return (
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold tracking-tight text-zinc-100">
              {tripTitle(row)}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{tripSubtitle(row)}</p>
          </div>
        );
      case "registration":
        return <span className="font-mono text-zinc-300">{row.registrationNumber}</span>;
      case "client":
        return (
          <span className="block truncate text-zinc-300" title={row.clientId}>
            {row.clientId}
          </span>
        );
      case "driver": {
        const name = row.driverName?.trim();
        if (row.driverId) {
          return (
            <Link
              href={`/fleet/drivers/${row.driverId}`}
              className="block truncate text-zinc-200 hover:text-emerald-300 hover:underline"
              title={name ?? row.driverId}
            >
              {name || "Șofer"}
            </Link>
          );
        }
        return <span className="block truncate text-zinc-300">{name || "—"}</span>;
      }
      case "start":
        return <span className="font-mono tabular-nums text-zinc-300">{formatDateTimeRo(row.startedAt)}</span>;
      case "stop":
        return (
          <span className="font-mono tabular-nums text-zinc-300">
            {row.endedAt ? formatDateTimeRo(row.endedAt) : "—"}
          </span>
        );
      case "km":
        return (
          <span className="font-mono tabular-nums text-zinc-200">
            {row.distanceKm != null ? row.distanceKm.toLocaleString("ro-RO") : "—"}
          </span>
        );
      case "status":
        return (
          <span
            className={`inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusClass(open)}`}
          >
            {open ? "Deschisă" : "Închisă"}
          </span>
        );
      case "actions":
        return renderActions(row);
      default:
        return null;
    }
  }

  const alignRight = (key: TripGridColumnKey) => key === "actions" || key === "km";

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
            Linii orizontale
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 hover:text-zinc-200">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
              checked={layout.colLines}
              onChange={(e) => persist({ ...layout, colLines: e.target.checked })}
            />
            Linii verticale
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowColumns((v) => !v)}
          className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
        >
          {showColumns ? "Închide coloane" : "Coloane…"}
        </button>
      </div>
      {showColumns ? (
        <ListColumnPicker
          title="Coloane listă curse"
          columns={TRIP_GRID_COLUMNS}
          layout={layout}
          onChange={persist}
          onReset={() => persist(defaultTripGridLayout())}
          onClose={() => setShowColumns(false)}
        />
      ) : null}

      <div className="space-y-3 md:hidden">
        {items.map((row) => {
          const open = !row.endedAt;
          return (
            <article
              key={row.id}
              className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-zinc-100">{tripTitle(row)}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{tripSubtitle(row)}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{row.clientId}</p>
                  {row.driverName ? (
                    <p className="mt-0.5 truncate text-xs text-zinc-400">Șofer: {row.driverName}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusClass(open)}`}
                >
                  {open ? "Deschisă" : "Închisă"}
                </span>
              </div>
              <p className="mt-3 font-mono text-xs tabular-nums text-zinc-400">
                {formatDateTimeRo(row.startedAt)}
                {row.endedAt ? ` → ${formatDateTimeRo(row.endedAt)}` : ""}
                {row.distanceKm != null ? ` · ${row.distanceKm.toLocaleString("ro-RO")} km` : ""}
              </p>
              <div className="mt-3 flex justify-end">{renderActions(row)}</div>
            </article>
          );
        })}
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
                      <span className="sr-only">{col.label}</span>
                    ) : (
                      col.label
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
