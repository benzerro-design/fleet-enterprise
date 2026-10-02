"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeleteVehicleButton } from "@/components/fleet/DeleteVehicleButton";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetThRightClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { VehicleColumnPicker } from "@/components/fleet/VehicleColumnPicker";
import { VehicleVisual } from "@/components/fleet/VehicleVisual";
import type { VehicleRecord } from "@/lib/fleet-api";
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
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100";


type Props = {
  vehicles: VehicleRecord[];
  canWrite: boolean;
};

export function VehiclesDataGrid({ vehicles, canWrite }: Props) {
  const [layout, setLayout] = useState<VehicleGridLayout>(() => readVehicleGridLayout());
  const [showColumns, setShowColumns] = useState(false);
  const columns = useMemo(() => {
    const cols = visibleVehicleColumns(layout);
    if (!canWrite) return cols.filter((c) => c.key !== "actions");
    return cols;
  }, [layout, canWrite]);

  function persist(next: VehicleGridLayout) {
    setLayout(next);
    writeVehicleGridLayout(next);
  }

  function renderCell(key: VehicleGridColumnKey, v: VehicleRecord) {
    switch (key) {
      case "registration":
        return (
          <div className="flex items-center gap-1.5">
            {v.heroPhotoUrl ? (
              <VehicleVisual photoUrl={v.heroPhotoUrl} alt={v.registrationNumber} size="xs" />
            ) : null}
            <span className="font-mono text-zinc-200">{v.registrationNumber}</span>
          </div>
        );
      case "brand":
        return <span className="text-zinc-300">{v.brand?.trim() || "—"}</span>;
      case "model":
        return <span className="text-zinc-300">{v.model?.trim() || "—"}</span>;
      case "vin":
        return (
          <span className="font-mono text-xs text-zinc-400" title={v.vin ?? undefined}>
            {v.vin ? `${v.vin.slice(0, 8)}…` : "—"}
          </span>
        );
      case "client":
        return <span className="text-zinc-300">{v.clientId}</span>;
      case "type":
        return <span className="text-zinc-300">{v.type}</span>;
      case "status":
        return <span className="text-zinc-300">{v.status}</span>;
      case "odometer":
        return <span className="font-mono text-zinc-300">{v.odometerKm}</span>;
      case "itp":
        return (
          <span className="font-mono text-zinc-300">
            {v.itpExpiresOn ? new Date(v.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
          </span>
        );
      case "detail":
        return (
          <Link
            href={`/fleet/vehicles/${v.id}`}
            className={`${iconBtnClass} text-emerald-400 hover:text-emerald-300`}
            title="Vezi detaliu"
            aria-label={`Vezi ${v.registrationNumber}`}
          >
            <IconEye className="h-3.5 w-3.5" />
          </Link>
        );
      case "actions":
        return canWrite ? (
          <div className="flex items-center justify-end gap-1">
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
          </div>
        ) : null;
      default:
        return null;
    }
  }

  const alignRight = (key: VehicleGridColumnKey) => key === "detail" || key === "actions";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowColumns((v) => !v)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
        >
          {showColumns ? "Închide coloane" : "Coloane…"}
        </button>
      </div>
      {showColumns ? (
        <VehicleColumnPicker layout={layout} onChange={persist} onClose={() => setShowColumns(false)} />
      ) : null}

      <div className="space-y-3 md:hidden">
        {vehicles.map((v) => (
          <article key={v.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            {v.heroPhotoUrl ? (
              <div className="relative aspect-[16/10] w-full bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.heroPhotoUrl}
                  alt={[v.brand, v.model, v.registrationNumber].filter(Boolean).join(" ")}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-zinc-100">{v.registrationNumber}</p>
                  {v.brand || v.model ? (
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {[v.brand, v.model].filter(Boolean).join(" ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500">
                    {v.clientId}
                    {v.type ? ` · ${v.type}` : ""}
                    {v.status ? ` · ${v.status}` : ""}
                  </p>
                  <p className="mt-2 font-mono text-xs text-zinc-300">
                    {v.odometerKm.toLocaleString("ro-RO")} km
                    {" · ITP "}
                    {v.itpExpiresOn ? new Date(v.itpExpiresOn).toLocaleDateString("ro-RO") : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/fleet/vehicles/${v.id}`}
                  className={`${iconBtnClass} text-emerald-400 hover:text-emerald-300`}
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
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <FleetDataTable>
          <table className={fleetTableClass}>
            <thead className={`${fleetTheadClass} tracking-wide`}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={alignRight(col.key) ? fleetThRightClass : fleetThClass}
                  >
                    {col.key === "actions" || col.key === "detail" ? (
                      <span className="sr-only">{col.label}</span>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {vehicles.map((v) => (
                <tr key={v.id} className="bg-transparent">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${fleetTdClass} ${alignRight(col.key) ? "text-right" : ""}`}
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
