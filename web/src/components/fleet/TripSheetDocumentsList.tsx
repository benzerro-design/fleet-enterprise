"use client";

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
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Titlu</th>
            <th className="px-4 py-3">Tip</th>
            <th className="px-4 py-3">Perioadă</th>
            <th className="px-4 py-3">Conducător</th>
            <th className="px-4 py-3">Creat</th>
            <th className="px-4 py-3 text-right">PDF</th>
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
                <td className="px-4 py-3">{row.title}</td>
                <td className="px-4 py-3 text-zinc-400">{row.docTypeLabel}</td>
                <td className="px-4 py-3 text-zinc-300">{formatPeriodRange(row.periodStart, row.periodEnd)}</td>
                <td className="px-4 py-3">{row.driverName ?? "—"}</td>
                <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString("ro-RO")}</td>
                <td className="px-4 py-3 text-right">
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
    </div>
  );
}
