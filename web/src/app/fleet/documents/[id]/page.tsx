import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/fleet/DeleteDocumentButton";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
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
  createdAt: string;
};

async function getDocument(id: string): Promise<DocumentRow | null> {
  const res = await fleetServerFetch(`/documents/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as DocumentRow;
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, auth] = await Promise.all([getDocument(id), getAuthMeResult()]);
  if (!row) notFound();

  const write = canManageFleet(auth);
  const expiry = documentExpiryStatus(row.expiresOn);
  const badge = documentExpiryBadge(expiry);

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Document</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{row.title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{documentTypeLabel(row.documentTypeCode)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
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
              <dt className="text-xs uppercase text-zinc-500">Tenant</dt>
              <dd className="mt-1 font-mono">{row.tenantSlug}</dd>
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
                    Deschide document
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          {write ? (
            <div className="mt-8 flex justify-end">
              <DeleteDocumentButton documentId={row.id} label={row.title} redirectTo="/fleet/documents" />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
