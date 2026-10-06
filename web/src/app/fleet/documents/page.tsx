import Link from "next/link";
import { cookies } from "next/headers";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { DeleteDocumentButton } from "@/components/fleet/DeleteDocumentButton";
import { DriverPager, DriverRecordList, DriverStatusBand } from "@/components/fleet/DriverPortalList";
import { DriverViewportSplit } from "@/components/fleet/DriverViewportSplit";
import { ReminderStatusBadge } from "@/components/fleet/ReminderStatusBadge";
import { canWriteFleetOps, getAuthMeResult, isClientDriverPortal } from "@/lib/auth-server";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
import type { DocumentReminderSummary } from "@/lib/document-reminders";
import { documentsBrowserBase } from "@/lib/fleet-api";
import { DOCUMENT_EXPIRY_STATUS_OPTIONS, DOCUMENT_TYPE_OPTIONS, documentTypeLabel } from "@/lib/document-types";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import { t } from "@/lib/i18n/t";
import { LOCALE_COOKIE_NAME, parseLocale } from "@/lib/i18n/types";

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
  fileUrlVerso?: string | null;
  fileNameVerso?: string | null;
  reminder?: DocumentReminderSummary;
  createdAt: string;
  linkedCostEntryId?: string | null;
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
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const [data, auth] = await Promise.all([fetchRows(sp), getAuthMeResult()]);
  const write = canWriteFleetOps(auth);
  const driverPortal = isClientDriverPortal(auth);
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

  const desktop = (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
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
        }
        filters={
          <form
            key={filterFormKey(sp)}
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
            <FilterResetLink href="/fleet/documents" />
          </form>
        }
      >
        {!data ? (
          <p className="text-amber-400">Nu am putut încărca documentele.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există documente pentru filtrele curente.</p>
        ) : (
          <>
            <div className="fleet-list-card-stack space-y-3">
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
                        <p className="text-xs text-zinc-500" data-fleet-list-extra>
                          Client: {row.clientId}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2" data-fleet-list-extra>
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
                      {row.linkedCostEntryId ? (
                        <Link
                          href={`/fleet/costs/${row.linkedCostEntryId}`}
                          className="rounded-lg border border-emerald-800/50 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/40"
                        >
                          Cost
                        </Link>
                      ) : null}
                      {row.fileUrl ? (
                        <a
                          href={row.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                        >
                          {row.fileUrlVerso ? "Față" : "Deschide fișier"}
                        </a>
                      ) : null}
                      {row.fileUrlVerso ? (
                        <a
                          href={row.fileUrlVerso}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                        >
                          Verso
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
      </FleetListPageLayout>
    </FleetPageMain>
  );

  if (!driverPortal) return desktop;

  const expiry =
    sp.expiryStatus === "valid" || sp.expiryStatus === "expiring" || sp.expiryStatus === "expired"
      ? sp.expiryStatus
      : "all";
  const bandHref = (next: string) =>
    next === "all" ? "/fleet/documents" : `/fleet/documents?expiryStatus=${next}`;
  const mobilePageHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (expiry !== "all") p.set("expiryStatus", expiry);
    if (nextPage > 1) p.set("page", String(nextPage));
    const qs = p.toString();
    return `/fleet/documents${qs ? `?${qs}` : ""}`;
  };
  const expiryBadge = (row: DocumentRow) => {
    const status = documentExpiryStatus(row.expiresOn);
    if (!status || status === "none") return undefined;
    return documentExpiryBadge(status).label;
  };

  const mobile = (
    <FleetPageMain>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t(locale, "driverLists.documents")}</h1>
      </div>
      <DriverStatusBand
        items={[
          { href: bandHref("all"), label: t(locale, "driverLists.all"), active: expiry === "all" },
          { href: bandHref("expiring"), label: t(locale, "driverLists.upcoming"), active: expiry === "expiring" },
          { href: bandHref("expired"), label: t(locale, "driverLists.expired"), active: expiry === "expired" },
        ]}
      />
      {data ? (
        <DriverRecordList
          empty={t(locale, "driverLists.empty")}
          items={data.items.map((row) => ({
            href: `/fleet/documents/${row.id}`,
            title: row.title,
            meta: [row.registrationNumber, documentTypeLabel(row.documentTypeCode)].filter(Boolean).join(" · "),
            badge: expiryBadge(row),
          }))}
        />
      ) : (
        <p className="py-8 text-sm text-amber-400">{t(locale, "driverLists.loadFailed")}</p>
      )}
      <DriverPager
        page={page}
        totalPages={totalPages}
        prevHref={page > 1 ? mobilePageHref(page - 1) : null}
        nextHref={page < totalPages ? mobilePageHref(page + 1) : null}
        prevLabel={t(locale, "driverLists.prev")}
        nextLabel={t(locale, "driverLists.next")}
      />
    </FleetPageMain>
  );

  return <DriverViewportSplit mobile={mobile} desktop={desktop} />;
}
