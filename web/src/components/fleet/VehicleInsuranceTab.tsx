import Link from "next/link";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
import { documentTypeLabel } from "@/lib/document-types";
import { formatDateRo } from "@/lib/datetime-local";
import { formatRonFromCents } from "@/lib/money";
import type { CostListPayload, DocumentListPayload } from "@/lib/vehicle-detail-server";

const INSURANCE_DOC_TYPES = new Set(["rca", "casco"]);
const INSURANCE_COST_CATEGORIES = new Set(["RCA", "CASCO"]);

type Props = {
  vehicleId: string;
  documents: DocumentListPayload | null;
  costs: CostListPayload | null;
  write: boolean;
};

export function VehicleInsuranceTab({ vehicleId, documents, costs, write }: Props) {
  const policies = (documents?.items ?? []).filter((d) => INSURANCE_DOC_TYPES.has(d.documentTypeCode));
  const premiums = (costs?.items ?? []).filter((c) => INSURANCE_COST_CATEGORIES.has(c.category));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Asigurări</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Polite RCA / CASCO din Documente, plus costurile legate. Același flux ca FLEET-020.
          </p>
        </div>
        {write ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/fleet/documents/new?vehicleId=${encodeURIComponent(vehicleId)}`}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Document nou
            </Link>
            <Link
              href={`/fleet/costs/new?vehicleId=${encodeURIComponent(vehicleId)}&category=RCA`}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Cost RCA
            </Link>
          </div>
        ) : null}
      </div>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Polite</h3>
        {policies.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nicio poliță RCA/CASCO pe acest vehicul.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">
            {policies.map((doc) => {
              const expiry = documentExpiryStatus(doc.expiresOn);
              const badge = documentExpiryBadge(expiry);
              return (
                <li key={doc.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm">
                  <div>
                    <Link href={`/fleet/documents/${doc.id}`} className="font-medium text-zinc-100 hover:text-emerald-300">
                      {doc.title}
                    </Link>
                    <p className="text-[11px] text-zinc-500">{documentTypeLabel(doc.documentTypeCode)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-md border px-2 py-0.5 ${badge.className}`}>{badge.label}</span>
                    <span className="text-zinc-500">{formatDateRo(doc.expiresOn)}</span>
                    {doc.linkedCostEntryId ? (
                      <Link href={`/fleet/costs/${doc.linkedCostEntryId}`} className="text-sky-400 hover:underline">
                        Cost
                      </Link>
                    ) : null}
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                        Fișier
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Costuri poliță</h3>
        {premiums.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Niciun cost RCA/CASCO înregistrat.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">
            {premiums.map((cost) => (
              <li key={cost.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm">
                <Link href={`/fleet/costs/${cost.id}`} className="font-medium text-zinc-100 hover:text-emerald-300">
                  {cost.category}
                  {cost.provider ? ` · ${cost.provider}` : ""}
                </Link>
                <span className="text-xs text-zinc-500">
                  {formatDateRo(cost.incurredOn)} · {formatRonFromCents(cost.amountCents)}
                  {cost.invoiceNumber ? ` · ${cost.invoiceNumber}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
