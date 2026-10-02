"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeleteVehicleButton } from "@/components/fleet/DeleteVehicleButton";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { VehicleColumnPicker } from "@/components/fleet/VehicleColumnPicker";
import { VehicleVisual } from "@/components/fleet/VehicleVisual";
import {
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type VehicleRecord,
} from "@/lib/fleet-api";
import {
  readVehicleGridLayout,
  type VehicleGridColumnKey,
  type VehicleGridLayout,
  visibleVehicleColumns,
  writeVehicleGridLayout,
} from "@/lib/vehicle-grid-columns";

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.5L19.5 9a1.8 1.8 0 0 0 0-2.5L17.5 4.5a1.8 1.8 0 0 0-2.5 0L4 15.5V20Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const iconBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700/80 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800/80 hover:text-zinc-100";

const TYPE_SHORT: Record<string, string> = {
  car: "Autoturism",
  van_lt_3_5: "≤ 3,5 t",
  van_gt_3_5: "> 3,5 t",
  tractor_unit: "Cap tractor",
  trailer: "Remorcă",
  semi_trailer: "Semiremorcă",
};

function typeLabel(type: string): string {
  return TYPE_SHORT[type] ?? VEHICLE_TYPES.find((t) => t.value === type)?.label ?? type;
}

function statusLabel(status: string): string {
  return VEHICLE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function statusClass(status: string): string {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "in_maintenance":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "inactive":
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
    case "decommissioned":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-zinc-600 bg-zinc-800/60 text-zinc-300";
  }
}

function vehicleTitle(v: VehicleRecord): string {
  return [v.brand, v.model].filter((x) => x?.trim()).join(" ");
}

type Props = {
  vehicles: VehicleRecord[];
  canWrite: boolean;
};

export function VehiclesDataGrid({ vehicles, canWrite }: Props) {
  const [layout, setLayout] = useState<VehicleGridLayout>(() => readVehicleGridLayout());
  const [showColumns, setShowColumns] = useState(false);
  const columns = useMemo(() => visibleVehicleColumns(layout), [layout]);

  function persist(next: VehicleGridLayout) {
    setLayout(next);
    writeVehicleGridLayout(next);
  }

  function renderActions(v: VehicleRecord) {
    return (
      <div className="inline-flex items-center justify-end gap-1">
        <Link
          href={`/fleet/vehicles/${v.id}`}
          className={`${iconBtnClass} text-emerald-400/90 hover:text-emerald-300`}
          title="Vezi detaliu"
          aria-label={`Vezi ${v.registrationNumber}`}
        >
          <IconEye className="h-3.5 w-3.5" />
        </Link>
        {canWrite ? (
          <>
            <Link
              href={`/fleet/vehicles/${v.id}/edit`}
              className={iconBtnClass}
              title="Editare"
              aria-label={`Editează ${v.registrationNumber}`}
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Link>
            <DeleteVehicleButton
              vehicleId={v.id}
              registrationNumber={v.registrationNumber}
              variant="icon"
            />
          </>
        ) : null}
      </div>
    );
  }

  function renderCell(key: VehicleGridColumnKey, v: VehicleRecord) {
    switch (key) {
      case "registration": {
        const title = vehicleTitle(v);
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            {v.heroPhotoUrl ? (
              <VehicleVisual photoUrl={v.heroPhotoUrl} alt={v.registrationNumber} size="sm" />
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-[10px] font-medium uppercase tracking-wide text-zinc-500 ring-1 ring-zinc-700/60"
                aria-hidden
              >
                —
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-mono text-[13px] font-semibold tracking-tight text-zinc-100">
                {v.registrationNumber}
              </p>
              {title ? (
                <p className="mt-0.5 truncate text-xs text-zinc-500">{title}</p>
              ) : (
                <p className="mt-0.5 truncate text-xs text-zinc-600">Fără marcă / model</p>
              )}
            </div>
          </div>
        );
      }
      case "brand":
        return <span className="truncate text-zinc-300">{v.brand?.trim() || "—"}</span>;
      case "model":
        return <span className="truncate text-zinc-300">{v.model?.trim() || "—"}</span>;
      case "vin":
        return (
          <span className="block truncate font-mono text-[11px] text-zinc-400" title={v.vin ?? undefined}>
            {v.vin?.trim() || "—"}
          </span>
        );
      case "client":
        return <span className="block truncate text-zinc-300" title={v.clientId}>{v.clientId}</span>;
      case "utilizator": {
        const name = v.assignedDriverName?.trim();
        const id = v.assignedDriverId;
        if (!name && !id) {
          return <span className="text-zinc-600">—</span>;
        }
        if (id) {
          return (
            <Link
              href={`/fleet/drivers/${id}`}
              className="block truncate text-zinc-200 hover:text-emerald-300 hover:underline"
              title={name ?? id}
            >
              {name || "Utilizator"}
            </Link>
          );
        }
        return (
          <span className="block truncate text-zinc-300" title={name}>
            {name}
          </span>
        );
      }
      case "type":
        return (
          <span className="text-zinc-300" title={VEHICLE_TYPES.find((t) => t.value === v.type)?.label}>
            {typeLabel(v.type)}
          </span>
        );
      case "status":
        return (
          <span
            className={`inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusClass(v.status)}`}
          >
            {statusLabel(v.status)}
          </span>
        );
      case "odometer":
        return (
          <span className="font-mono tabular-nums text-zinc-200">
            {v.odometerKm.toLocaleString("ro-RO")}
          </span>
        );
      case "itp":
        return (
          <span className="font-mono tabular-nums text-zinc-300">
            {v.itpExpiresOn ? new Date(v.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
          </span>
        );
      case "actions":
        return renderActions(v);
      default:
        return null;
    }
  }

  const alignRight = (key: VehicleGridColumnKey) =>
    key === "actions" || key === "odometer" || key === "itp";

  // Border pe td/th — pe <tr> border-ul e ignorat de browsere la border-collapse/separate.
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
        <VehicleColumnPicker layout={layout} onChange={persist} onClose={() => setShowColumns(false)} />
      ) : null}

      <div className="space-y-3 md:hidden">
        {vehicles.map((v) => {
          const title = vehicleTitle(v);
          return (
            <article
              key={v.id}
              className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/50"
            >
              {v.heroPhotoUrl ? (
                <div className="relative aspect-[16/10] w-full bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.heroPhotoUrl}
                    alt={[title, v.registrationNumber].filter(Boolean).join(" ")}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-zinc-100">{v.registrationNumber}</p>
                    {title ? <p className="mt-0.5 text-xs text-zinc-400">{title}</p> : null}
                    <p className="mt-1 truncate text-xs text-zinc-500">{v.clientId}</p>
                    {v.assignedDriverName ? (
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        Utilizator:{" "}
                        {v.assignedDriverId ? (
                          <Link
                            href={`/fleet/drivers/${v.assignedDriverId}`}
                            className="text-zinc-300 hover:text-emerald-300 hover:underline"
                          >
                            {v.assignedDriverName}
                          </Link>
                        ) : (
                          v.assignedDriverName
                        )}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusClass(v.status)}`}
                  >
                    {statusLabel(v.status)}
                  </span>
                </div>
                <p className="mt-3 font-mono text-xs tabular-nums text-zinc-400">
                  {v.odometerKm.toLocaleString("ro-RO")} km
                  {" · ITP "}
                  {v.itpExpiresOn ? new Date(v.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
                </p>
                <div className="mt-3 flex justify-end">{renderActions(v)}</div>
              </div>
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
              {vehicles.map((v) => (
                <tr key={v.id} className="bg-transparent transition-colors hover:bg-zinc-900/50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${fleetTdClass} align-middle ${rowLineCell} ${colLineCell} ${
                        alignRight(col.key) ? "text-right" : ""
                      } ${col.key === "registration" ? "py-2.5" : ""}`}
                    >
                      {renderCell(col.key, v)}
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
