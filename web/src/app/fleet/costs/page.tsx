import Link from "next/link";
import { cookies } from "next/headers";
import { CostsDataGrid } from "@/components/fleet/CostsDataGrid";
import { DriverPager, DriverRecordList, DriverStatusBand } from "@/components/fleet/DriverPortalList";
import { DriverViewportSplit } from "@/components/fleet/DriverViewportSplit";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canWriteCosts, getAuthMeResult, isClientDriverPortal } from "@/lib/auth-server";
import { costsBrowserBase } from "@/lib/fleet-api";
import { filterFormKey } from "@/lib/filter-form-key";
import { FUEL_COST_CATEGORY } from "@/lib/fuel-ops";
import { fleetServerFetch } from "@/lib/fleet-server";
import { t } from "@/lib/i18n/t";
import { LOCALE_COOKIE_NAME, parseLocale } from "@/lib/i18n/types";

type Search = {
  page?: string;
  registrationNumber?: string;
  clientId?: string;
  category?: string;
  provider?: string;
  q?: string;
  incurredFrom?: string;
  incurredTo?: string;
};

type CostRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  category: string;
  provider: string | null;
  amountCents: number;
  odometerKm: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  incurredOn: string;
  notes: string | null;
  linkedDocumentId?: string | null;
  vehicleEquipmentId?: string | null;
  vehicleEquipmentLabel?: string | null;
};

type Payload = { items: CostRow[]; total: number; page: number; pageSize: number };

function buildQuery(sp: Search): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "20");
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.category?.trim()) q.set("category", sp.category.trim());
  if (sp.provider?.trim()) q.set("provider", sp.provider.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.incurredFrom?.trim()) q.set("incurredFrom", sp.incurredFrom.trim());
  if (sp.incurredTo?.trim()) q.set("incurredTo", sp.incurredTo.trim());
  return q.toString();
}

function buildExportQuery(sp: Search): string {
  const q = new URLSearchParams();
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.category?.trim()) q.set("category", sp.category.trim());
  if (sp.provider?.trim()) q.set("provider", sp.provider.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.incurredFrom?.trim()) q.set("incurredFrom", sp.incurredFrom.trim());
  if (sp.incurredTo?.trim()) q.set("incurredTo", sp.incurredTo.trim());
  return q.toString();
}

async function fetchRows(sp: Search): Promise<Payload | null> {
  const res = await fleetServerFetch(`/costs?${buildQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as Payload;
}

type Props = { searchParams: Promise<Search> };

export default async function CostsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const [data, auth] = await Promise.all([fetchRows(sp), getAuthMeResult()]);
  const write = canWriteCosts(auth);
  const driverPortal = isClientDriverPortal(auth);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  const exportQs = buildExportQuery(sp);
  const exportHref = `${costsBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  const withPage = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set("page", String(nextPage));
    if (sp.registrationNumber?.trim()) p.set("registrationNumber", sp.registrationNumber.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    if (sp.category?.trim()) p.set("category", sp.category.trim());
    if (sp.provider?.trim()) p.set("provider", sp.provider.trim());
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.incurredFrom?.trim()) p.set("incurredFrom", sp.incurredFrom.trim());
    if (sp.incurredTo?.trim()) p.set("incurredTo", sp.incurredTo.trim());
    return `/fleet/costs?${p.toString()}`;
  };

  const desktop = (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">{t(locale, "pages.costs.eyebrow")}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t(locale, "pages.costs.title")}</h1>
              <p className="mt-3 text-zinc-400">
                {t(locale, "pages.costs.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {write ? (
                <Link
                  href="/fleet/costs/new"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
                >
                  {t(locale, "pages.costs.newCost")}
                </Link>
              ) : null}
              <a
                href={exportHref}
                className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                {t(locale, "common.actions.exportCsv")}
              </a>
              <Link
                href="/fleet/vehicles"
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                {t(locale, "common.actions.backToVehicles")}
              </Link>
            </div>
          </div>
        }
        filters={
          <form
            key={filterFormKey(sp)}
            action="/fleet/costs"
            method="get"
            className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <input type="hidden" name="page" value="1" />
            <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "common.filters.registrationNumber")}</label>
              <input
                name="registrationNumber"
                defaultValue={sp.registrationNumber ?? ""}
                placeholder="ex. B 123 ABC"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "common.filters.client")}</label>
              <input
                name="clientId"
                defaultValue={sp.clientId ?? ""}
                placeholder="ex. Client A"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "pages.costs.categoryExact")}</label>
              <input
                name="category"
                defaultValue={sp.category ?? ""}
                placeholder="ex. combustibil"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "pages.costs.provider")}</label>
              <input
                name="provider"
                defaultValue={sp.provider ?? ""}
                placeholder="ex. Petrom"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "common.filters.searchText")}</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder={t(locale, "pages.costs.searchPlaceholder")}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[9rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "pages.costs.dateFrom")}</label>
              <input
                name="incurredFrom"
                type="date"
                defaultValue={sp.incurredFrom ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[9rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "pages.costs.dateTo")}</label>
              <input
                name="incurredTo"
                type="date"
                defaultValue={sp.incurredTo ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
              {t(locale, "common.actions.apply")}
            </button>
            <FilterResetLink href="/fleet/costs" />
          </form>
        }
      >
        {!data ? (
          <p className="text-amber-400">Nu am putut încărca costurile.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există costuri pentru filtrele curente.</p>
        ) : (
          <>
            <CostsDataGrid items={data.items} canWrite={write} />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
              <p>
                Pagina {page} din {totalPages} · {data.total} costuri
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={withPage(page - 1)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900"
                  >
                    ← Anterior
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={withPage(page + 1)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900"
                  >
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

  const fuelOnly = sp.category === FUEL_COST_CATEGORY;
  const mobilePageHref = (nextPage: number, fuel: boolean) => {
    const p = new URLSearchParams();
    if (fuel) p.set("category", FUEL_COST_CATEGORY);
    if (nextPage > 1) p.set("page", String(nextPage));
    const qs = p.toString();
    return `/fleet/costs${qs ? `?${qs}` : ""}`;
  };
  const categoryLabel = (category: string) => {
    const key = `ops.catalogs.costCategories.${category}`;
    const label = t(locale, key);
    return label === key ? category : label;
  };

  const mobile = (
    <FleetPageMain>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t(locale, "driverLists.costs")}</h1>
        {write ? (
          <Link
            href={`/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}`}
            className="text-sm font-medium text-emerald-400"
          >
            {t(locale, "driver.home.fuel")}
          </Link>
        ) : null}
      </div>
      <DriverStatusBand
        items={[
          { href: "/fleet/costs", label: t(locale, "driverLists.all"), active: !fuelOnly },
          { href: mobilePageHref(1, true), label: t(locale, "driverLists.fuelOnly"), active: fuelOnly },
        ]}
      />
      {data ? (
        <DriverRecordList
          empty={t(locale, "driverLists.empty")}
          items={data.items.map((row) => ({
            href: `/fleet/costs/${row.id}`,
            title: categoryLabel(row.category),
            meta: [row.registrationNumber, new Date(row.incurredOn).toLocaleDateString("ro-RO")].join(" · "),
            badge: `${(row.amountCents / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`,
          }))}
        />
      ) : (
        <p className="py-8 text-sm text-amber-400">{t(locale, "driverLists.loadFailed")}</p>
      )}
      <DriverPager
        page={page}
        totalPages={totalPages}
        prevHref={page > 1 ? mobilePageHref(page - 1, fuelOnly) : null}
        nextHref={page < totalPages ? mobilePageHref(page + 1, fuelOnly) : null}
        prevLabel={t(locale, "driverLists.prev")}
        nextLabel={t(locale, "driverLists.next")}
      />
    </FleetPageMain>
  );

  return <DriverViewportSplit mobile={mobile} desktop={desktop} />;
}
