"use client";

import Link from "next/link";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import {
  supplierCategoryLabel,
  supplierStatusLabel,
  type SupplierRecord,
} from "@/lib/suppliers-api";
import { supplierServiceLabel } from "@/lib/supplier-service-catalog";

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
  return (
    <FleetDataTable>
      <table className={fleetTableClass}>
        <thead className={`${fleetTheadClass} tracking-wide`}>
          <tr>
            <th className={fleetThClass}>St.</th>
            <th className={fleetThClass}>Cod</th>
            <th className={fleetThClass}>Denumire</th>
            <th className={fleetThClass}>Categorie</th>
            <th className={fleetThClass}>Servicii</th>
            <th className={fleetThClass}>WO</th>
            <th className={fleetThClass}>CUI</th>
            <th className={fleetThClass} />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/80">
          {items.map((row) => (
            <tr key={row.id} className="text-zinc-200 hover:bg-zinc-900/40">
              <td className={`${fleetTdClass} w-8`}>
                <span className={statusColor(row.status)} title={supplierStatusLabel(row.status)}>
                  {statusGlyph(row.status)}
                </span>
              </td>
              <td className={`${fleetTdClass} font-mono text-xs`}>
                <Link href={`/fleet/suppliers/${row.id}`} className="text-sky-300/90 hover:underline">
                  {row.code}
                </Link>
              </td>
              <td className={fleetTdClass}>
                <Link href={`/fleet/suppliers/${row.id}`} className="hover:text-emerald-200 hover:underline">
                  {row.legalName}
                </Link>
              </td>
              <td className={`${fleetTdClass} text-xs text-zinc-400`}>
                {supplierCategoryLabel(row.category)}
              </td>
              <td className={`${fleetTdClass} text-xs text-zinc-400`}>
                {row.services?.length
                  ? row.services.slice(0, 2).map(supplierServiceLabel).join(", ") +
                    (row.services.length > 2 ? ` +${row.services.length - 2}` : "")
                  : "—"}
              </td>
              <td className={fleetTdClass}>{row.workOrderCount}</td>
              <td className={`${fleetTdClass} font-mono text-xs text-zinc-500`}>{row.taxId ?? "—"}</td>
              <td className={`${fleetTdClass} text-right text-xs`}>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </FleetDataTable>
  );
}
