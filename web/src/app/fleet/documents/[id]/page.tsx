import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/fleet/DeleteDocumentButton";
import { ReminderStatusBadge } from "@/components/fleet/ReminderStatusBadge";
import { canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
import {
  formatOffsetDaysLabel,
  type DocumentReminderSummary,
} from "@/lib/document-reminders";
import { documentTypeLabel } from "@/lib/document-types";
import { fleetServerFetch } from "@/lib/fleet-server";

type DocumentRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  documentTypeCode: string;
  title: string;
  expiresOn: string | null;
  fileUrl: string | null;
  fileName: string | null;
  reminderOffsetsDays: number[] | null;
  reminder: DocumentReminderSummary;
  createdAt: string;
};

async function getDocument(id: string): Promise<DocumentRow | null> {
  const res = await fleetServerFetch(`/documents/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as DocumentRow;
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reminderSync?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [row, auth] = await Promise.all([getDocument(id), getAuthMeResult()]);
  if (!row) notFound();

  const write = canWriteFleetOps(auth);
  const expiry = documentExpiryStatus(row.expiresOn);
  const badge = documentExpiryBadge(expiry);

  return (
    <FleetPageMain>
        {sp.reminderSync === "failed" ? (
          <p className="mb-6 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Documentul a fost salvat, dar acțiunea din meniul Remindere nu s-a creat (probabil migrarea DB nu e
            aplicată pe server). Rulează <code className="font-mono text-xs">npx prisma migrate deploy</code> în folderul{" "}
            <code className="font-mono text-xs">api</code>, apoi editează documentul și salvează din nou.
          </p>
        ) : null}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Document</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{row.title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{documentTypeLabel(row.documentTypeCode)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/fleet/vehicles/${row.vehicleId}#reminders`}
              className="rounded-lg border border-violet-800/60 bg-violet-950/30 px-4 py-2 text-sm text-violet-200 hover:bg-violet-950/50"
            >
              Remindere vehicul
            </Link>
            <Link
              href="/fleet/documents"
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Înapoi la listă
            </Link>
            {write ? (
              <Link
                href={`/fleet/documents/${id}/edit`}
                className="rounded-lg border border-zinc-600 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Editare
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
            {row.reminder ? <ReminderStatusBadge reminder={row.reminder} /> : null}
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-zinc-500">Număr auto</dt>
              <dd className="mt-1 font-mono">
                <Link href={`/fleet/vehicles/${row.vehicleId}`} className="text-emerald-400 hover:underline">
                  {row.registrationNumber}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Client</dt>
              <dd className="mt-1">{row.clientId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Data expirare</dt>
              <dd className="mt-1">
                {row.expiresOn ? new Date(row.expiresOn).toLocaleDateString("ro-RO") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Înregistrat</dt>
              <dd className="mt-1">{new Date(row.createdAt).toLocaleString("ro-RO")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-zinc-500">Fișier</dt>
              <dd className="mt-1">
                {row.fileUrl ? (
                  <a className="text-emerald-400 hover:underline" href={row.fileUrl} target="_blank" rel="noreferrer">
                    {row.fileName ?? "Deschide document"}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>

        {row.reminderOffsetsDays?.length ? (
          <section className="mt-6 rounded-xl border border-violet-900/40 bg-violet-950/10 p-6">
            <h2 className="text-sm font-medium text-violet-100">Program remindere</h2>
            <ul className="mt-4 space-y-2">
              {row.reminder.timeline.map((t) => (
                <li key={t.offsetDays} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-zinc-400">{formatOffsetDaysLabel(t.offsetDays)}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-200">
                      {new Date(t.remindOn).toLocaleDateString("ro-RO")}
                    </span>
                    {t.status === "past" ? (
                      <span className="text-[10px] text-zinc-600">trecut</span>
                    ) : t.status === "today" ? (
                      <span className="rounded bg-amber-500/20 px-1.5 text-[10px] text-amber-200">azi</span>
                    ) : (
                      <span className="text-[10px] text-violet-400">viitor</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {write ? (
          <div className="mt-8 flex justify-end">
            <DeleteDocumentButton documentId={row.id} label={row.title} redirectTo="/fleet/documents" />
          </div>
        ) : null}
    </FleetPageMain>
  );
}
