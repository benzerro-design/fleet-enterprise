"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { useSupplierGridColumns } from "@/components/fleet/suppliers/SupplierGridColumnProvider";
import {
  supplierCategoryLabel,
  supplierStatusLabel,
  type SupplierRecord,
} from "@/lib/suppliers-api";
import { supplierServiceLabel } from "@/lib/supplier-service-catalog";
import {
  type SupplierGridColumnKey,
  visibleSupplierColumns,
} from "@/lib/supplier-grid-columns";

function statusGlyph(status: SupplierRecord["status"]): string {
  if (status === "active") return "●";
  if (status === "blocked") return "■";
  return "○";
}

function statusColor(status: SupplierRecord["status"]): string {
  if (status === "active") return "text-emerald-400";
  if (status === "blocked") return "text-red-400";
  return "text-zinc-500";
}

type Props = {
  items: SupplierRecord[];
  canWrite: boolean;
};

export function SupplierDataGrid({ items, canWrite }: Props) {
  const { layout } = useSupplierGridColumns();
  const columns = useMemo(() => visibleSupplierColumns(layout), [layout]);

  function renderCell(key: SupplierGridColumnKey, row: SupplierRecord) {
    switch (key) {
      case "status":
        return (
          <span className={statusColor(row.status)} title={supplierStatusLabel(row.status)}>
            {statusGlyph(row.status)}
          </span>
        );
      case "code":
        return (
          <Link href={`/fleet/suppliers/${row.id}`} className="font-mono text-xs text-sky-300/90 hover:underline">
            {row.code}
          </Link>
        );
      case "legalName":
        return (
          <Link href={`/fleet/suppliers/${row.id}`} className="hover:text-emerald-200 hover:underline">
            {row.legalName}
          </Link>
        );
      case "category":
        return <span className="text-xs text-zinc-400">{supplierCategoryLabel(row.category)}</span>;
      case "services":
        return (
          <span className="text-xs text-zinc-400">
            {row.services?.length
              ? row.services.slice(0, 2).map(supplierServiceLabel).join(", ") +
                (row.services.length > 2 ? ` +${row.services.length - 2}` : "")
              : "—"}
          </span>
        );
      case "workOrderCount":
        return row.workOrderCount;
      case "taxId":
        return <span className="font-mono text-xs text-zinc-500">{row.taxId ?? "—"}</span>;
      case "contactEmail":
        return (
          <span className="text-xs text-zinc-400">{row.contactEmail ?? "—"}</span>
        );
      case "city":
        return <span className="text-xs text-zinc-400">{row.city ?? "—"}</span>;
      case "actions":
        return (
          <span className="text-right text-xs">
            <Link href={`/fleet/suppliers/${row.id}`} className="text-violet-400 hover:underline">
              Fișă
            </Link>
            {canWrite ? (
              <>
                {" · "}
                <Link href={`/fleet/suppliers/${row.id}/edit`} className="text-emerald-400 hover:underline">
                  Edit
                </Link>
              </>
            ) : null}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <FleetDataTable>
      <table className={fleetTableClass}>
        <thead className={`${fleetTheadClass} tracking-wide`}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.key === "status" ? `${fleetThClass} w-8` : fleetThClass}
                style={{ minWidth: col.minWidth }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80">
          {items.map((row) => (
            <tr key={row.id} className="text-zinc-200 hover:bg-zinc-900/40">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={
                    col.key === "actions"
                      ? `${fleetTdClass} text-right text-xs`
                      : col.key === "status"
                        ? `${fleetTdClass} w-8`
                        : fleetTdClass
                  }
                >
                  {renderCell(col.key, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </FleetDataTable>
  );
}
