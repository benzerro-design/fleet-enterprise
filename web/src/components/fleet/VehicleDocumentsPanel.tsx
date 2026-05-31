"use client";

import Link from "next/link";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
import { documentTypeLabel } from "@/lib/document-types";
import type { DocumentReminderSummary } from "@/lib/document-reminders";
import { ReminderStatusBadge } from "@/components/fleet/ReminderStatusBadge";

export type VehicleDocumentRow = {
  id: string;
  title: string;
  documentTypeCode: string;
  expiresOn: string | null;
  fileUrl: string | null;
  reminder?: DocumentReminderSummary;
};

type Props = {
  items: VehicleDocumentRow[];
  totalInDb: number;
  regQs: string;
};

export function VehicleDocumentsPanel({ items, totalInDb, regQs }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Nu există documente înregistrate.</p>;
  }

  return (
    <>
      <ul className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
        {items.map((d) => {
          const badge = documentExpiryBadge(documentExpiryStatus(d.expiresOn));
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <Link href={`/fleet/documents/${d.id}`} className="text-zinc-200 hover:text-white">
                  {d.title}
                </Link>
                <p className="text-xs text-zinc-500">{documentTypeLabel(d.documentTypeCode)}</p>
              </div>
                      <div className="flex items-center gap-2">
                        {d.reminder ? <ReminderStatusBadge reminder={d.reminder} compact /> : null}
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="text-xs text-zinc-500">
                  {d.expiresOn ? new Date(d.expiresOn).toLocaleDateString("ro-RO") : "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {totalInDb > items.length ? (
        <p className="mt-2 text-xs text-zinc-500">
          Afișate primele {items.length} din {totalInDb}.{" "}
          <Link href={`/fleet/documents?${regQs}`} className="text-emerald-400 hover:underline">
            Vezi restul în listă
          </Link>
        </p>
      ) : null}
    </>
  );
}

/** Rezumat pentru header accordion (închis). */
export function vehicleDocumentsSummary(items: VehicleDocumentRow[], totalInDb: number): string {
  if (totalInDb === 0) return "Niciun document";
  const expiring = items.filter((d) => {
    const s = documentExpiryStatus(d.expiresOn);
    return s === "expiring" || s === "expired";
  }).length;
  const countLabel = totalInDb === 1 ? "1 document" : `${totalInDb} documente`;
  if (expiring > 0) return `${countLabel} · ${expiring} atenție expirare`;
  return countLabel;
}
