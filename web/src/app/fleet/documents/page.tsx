import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { DeleteDocumentButton } from "@/components/fleet/DeleteDocumentButton";
import { ReminderStatusBadge } from "@/components/fleet/ReminderStatusBadge";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
import type { DocumentReminderSummary } from "@/lib/document-reminders";
import { documentsBrowserBase } from "@/lib/fleet-api";
import { DOCUMENT_EXPIRY_STATUS_OPTIONS, DOCUMENT_TYPE_OPTIONS, documentTypeLabel } from "@/lib/document-types";
import { fleetServerFetch } from "@/lib/fleet-server";

type Search = {
  page?: string;
  registrationNumber?: string;
  clientId?: string;
  documentTypeCode?: string;
  expiryStatus?: string;
  q?: string;
  expiresFrom?: string;
  expiresTo?: string;
};

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
  reminder?: DocumentReminderSummary;
  createdAt: string;
};

type Payload = { items: DocumentRow[]; total: number; page: number; pageSize: number };

function buildQuery(sp: Search): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "20");
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.documentTypeCode?.trim()) q.set("documentTypeCode", sp.documentTypeCode.trim());
  if (sp.expiryStatus?.trim()) q.set("expiryStatus", sp.expiryStatus.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.expiresFrom?.trim()) q.set("expiresFrom", sp.expiresFrom.trim());
  if (sp.expiresTo?.trim()) q.set("expiresTo", sp.expiresTo.trim());
  return q.toString();
}

function buildExportQuery(sp: Search): string {
  const q = new URLSearchParams();
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.documentTypeCode?.trim()) q.set("documentTypeCode", sp.documentTypeCode.trim());
  if (sp.expiryStatus?.trim()) q.set("expiryStatus", sp.expiryStatus.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.expiresFrom?.trim()) q.set("expiresFrom", sp.expiresFrom.trim());
  if (sp.expiresTo?.trim()) q.set("expiresTo", sp.expiresTo.trim());
  return q.toString();
}

async function fetchRows(sp: Search): Promise<Payload | null> {
  const res = await fleetServerFetch(`/documents?${buildQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as Payload;
}

type Props = { searchParams: Promise<Search> };

export default async function DocumentsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [data, auth] = await Promise.all([fetchRows(sp), getAuthMeResult()]);
  const write = canManageFleet(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  const exportQs = buildExportQuery(sp);
  const exportHref = `${documentsBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  const withPage = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set("page", String(nextPage));
    if (sp.registrationNumber?.trim()) p.set("registrationNumber", sp.registrationNumber.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    if (sp.documentTypeCode?.trim()) p.set("documentTypeCode", sp.documentTypeCode.trim());
    if (sp.expiryStatus?.trim()) p.set("expiryStatus", sp.expiryStatus.trim());
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.expiresFrom?.trim()) p.set("expiresFrom", sp.expiresFrom.trim());
    if (sp.expiresTo?.trim()) p.set("expiresTo", sp.expiresTo.trim());
    return `/fleet/documents?${p.toString()}`;
  };

  return (
    <FleetPageMain>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Conformitate</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Documente</h1>
            <p className="mt-3 text-zinc-400">
              RCA, CASCO, certificat înmatriculare, CIV și altele — filtrare după vehicul, tip și status expirare.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {write ? (
              <Link
                href="/fleet/documents/new"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
              >
                Document nou
              </Link>
            ) : null}
            <a
              href={exportHref}
              className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Export CSV
            </a>
            <Link
              href="/fleet/vehicles"
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Înapoi la vehicule
            </Link>
          </div>
        </div>

        <form
          action="/fleet/documents"
          method="get"
          className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <input type="hidden" name="page" value="1" />
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Nr. înmatriculare</label>
            <input
              name="registrationNumber"
              defaultValue={sp.registrationNumber ?? ""}
              placeholder="ex. B 123 ABC"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Client</label>
            <input
              name="clientId"
              defaultValue={sp.clientId ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[11rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Tip document</label>
            <select
              name="documentTypeCode"
              defaultValue={sp.documentTypeCode ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="">Toate</option>
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[11rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Status expirare</label>
            <select
              name="expiryStatus"
              defaultValue={sp.expiryStatus ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              {DOCUMENT_EXPIRY_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Căutare</label>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Titlu, tip…"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[9rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Expiră de la</label>
            <input
              name="expiresFrom"
              type="date"
              defaultValue={sp.expiresFrom ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex min-w-[9rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Expiră până la</label>
            <input
              name="expiresTo"
              type="date"
              defaultValue={sp.expiresTo ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
            Aplică
          </button>
          <Link href="/fleet/documents" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400">
            Resetează
          </Link>
        </form>

        {!data ? (
          <p className="text-amber-400">Nu am putut încărca documentele.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există documente pentru filtrele curente.</p>
        ) : (
          <>
            <div className="space-y-3">
              {data.items.map((row) => {
                const expiry = documentExpiryStatus(row.expiresOn);
                const badge = documentExpiryBadge(expiry);
                return (
                  <article key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-zinc-100">{row.title}</h2>
                        <p className="mt-1 text-xs text-zinc-400">{documentTypeLabel(row.documentTypeCode)}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {row.reminder ? <ReminderStatusBadge reminder={row.reminder} compact /> : null}
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-zinc-400">{row.registrationNumber}</p>
                        <p className="text-xs text-zinc-500">Client: {row.clientId}</p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">Expiră</dt>
                        <dd>
                          {row.expiresOn
                            ? new Date(row.expiresOn).toLocaleDateString("ro-RO")
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">Înregistrat</dt>
                        <dd>{new Date(row.createdAt).toLocaleDateString("ro-RO")}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/fleet/documents/${row.id}`}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                      >
                        Vezi detaliu
                      </Link>
                      <Link
                        href={`/fleet/vehicles/${row.vehicleId}`}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                      >
                        Vehicul
                      </Link>
                      {row.fileUrl ? (
                        <a
                          href={row.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                        >
                          Deschide fișier
                        </a>
                      ) : null}
                      {write ? (
                        <>
                          <Link
                            href={`/fleet/documents/${row.id}/edit`}
                            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                          >
                            Editare
                          </Link>
                          <DeleteDocumentButton documentId={row.id} label={row.title} />
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="flex justify-between text-sm text-zinc-400">
              <span>
                Pagina {page} / {totalPages} · {data.total} documente
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={withPage(page - 1)} className="text-emerald-400 hover:underline">
                    ← Anterior
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={withPage(page + 1)} className="text-emerald-400 hover:underline">
                    Următor →
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
    </FleetPageMain>
  );
}
