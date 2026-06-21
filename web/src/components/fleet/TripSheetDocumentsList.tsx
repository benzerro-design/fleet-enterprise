"use client";

import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetThRightClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { formatPeriodRange } from "@/lib/calendar-date";

type DocRow = {
  id: string;
  docType: string;
  docTypeLabel: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  driverName: string | null;
  createdAt: string;
};

type Props = {
  items: DocRow[];
  highlightId?: string | null;
};

export function TripSheetDocumentsList({ items, highlightId }: Props) {
  if (items.length === 0) {
    return <p className="text-zinc-400">Nu există documente generate încă.</p>;
  }

  return (
    <FleetDataTable>
      <table className={fleetTableClass}>
        <thead className={fleetTheadClass}>
          <tr>
            <th className={fleetThClass}>Titlu</th>
            <th className={fleetThClass}>Tip</th>
            <th className={fleetThClass}>Perioadă</th>
            <th className={fleetThClass}>Conducător</th>
            <th className={fleetThClass}>Creat</th>
            <th className={fleetThRightClass}>PDF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {items.map((row) => {
            const highlighted = highlightId === row.id;
            return (
              <tr
                key={row.id}
                className={highlighted ? "bg-emerald-950/30" : "bg-zinc-900/30"}
              >
                <td className={fleetTdClass}>{row.title}</td>
                <td className={`${fleetTdClass} text-zinc-400`}>{row.docTypeLabel}</td>
                <td className={`${fleetTdClass} text-zinc-300`}>{formatPeriodRange(row.periodStart, row.periodEnd)}</td>
                <td className={fleetTdClass}>{row.driverName ?? "—"}</td>
                <td className={fleetTdClass}>{new Date(row.createdAt).toLocaleString("ro-RO")}</td>
                <td className={`${fleetTdClass} text-right`}>
                  <a
                    href={`/api/trip-sheets/${row.id}/pdf`}
                    className="text-emerald-400 hover:underline"
                    download
                  >
                    Descarcă
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </FleetDataTable>
  );
}
