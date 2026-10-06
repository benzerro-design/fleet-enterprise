import { DriverLicenseAlertsStrip } from "@/components/fleet/DriverLicenseAlertsStrip";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { RemindersListView } from "@/components/fleet/RemindersListView";
import { RemindersStatusToolbar } from "@/components/fleet/RemindersStatusToolbar";
import { DriverStatusBand } from "@/components/fleet/DriverPortalList";
import { DriverViewportSplit } from "@/components/fleet/DriverViewportSplit";
import { canWriteFleetOps, driverIdFromAuth, getAuthMeResult, isClientDriverPortal } from "@/lib/auth-server";
import { resolveCurrentVehicleId } from "@/lib/driver-portal-server";
import { remindersBrowserBase } from "@/lib/fleet-api";
import { filterFormKey } from "@/lib/filter-form-key";
import type { DriverLicenseAlert } from "@/lib/drivers-api";
import { fleetServerFetch } from "@/lib/fleet-server";
import { t } from "@/lib/i18n/t";
import { LOCALE_COOKIE_NAME, parseLocale } from "@/lib/i18n/types";

type Search = {
  page?: string;
  registrationNumber?: string;
  clientId?: string;
  vehicleId?: string;
  sourceType?: string;
  status?: string;
  q?: string;
  dueFrom?: string;
  dueTo?: string;
};

function buildExportQuery(sp: Search): string {
  const q = new URLSearchParams();
  if (sp.registrationNumber?.trim()) q.set("registrationNumber", sp.registrationNumber.trim());
  if (sp.clientId?.trim()) q.set("clientId", sp.clientId.trim());
  if (sp.vehicleId?.trim()) q.set("vehicleId", sp.vehicleId.trim());
  if (sp.sourceType?.trim()) q.set("sourceType", sp.sourceType.trim());
  if (sp.status?.trim()) q.set("status", sp.status.trim());
  if (sp.q?.trim()) q.set("q", sp.q.trim());
  if (sp.dueFrom?.trim()) q.set("dueFrom", sp.dueFrom.trim());
  if (sp.dueTo?.trim()) q.set("dueTo", sp.dueTo.trim());
  return q.toString();
}

type Props = { searchParams: Promise<Search> };

async function loadDriverLicenseAlerts(): Promise<DriverLicenseAlert[]> {
  try {
    const res = await fleetServerFetch("/drivers/license-alerts?limit=8");
    if (!res?.ok) return [];
    return (await res.json()) as DriverLicenseAlert[];
  } catch {
    return [];
  }
}

export default async function FleetRemindersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const [auth, licenseAlerts] = await Promise.all([getAuthMeResult(), loadDriverLicenseAlerts()]);
  const write = canWriteFleetOps(auth);
  const driverPortal = isClientDriverPortal(auth);
  const exportQs = buildExportQuery(sp);
  const exportHref = `${remindersBrowserBase}/export${exportQs ? `?${exportQs}` : ""}`;

  const desktop = (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-violet-400">{t(locale, "pages.reminders.eyebrow")}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t(locale, "pages.reminders.title")}</h1>
              <p className="mt-3 max-w-xl text-sm text-zinc-400">
                {t(locale, "pages.reminders.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {write ? (
                <Link
                  href="/fleet/reminders/new"
                  className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  {t(locale, "pages.reminders.newAction")}
                </Link>
              ) : null}
              <a
                href={exportHref}
                className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                {t(locale, "common.actions.exportCsv")}
              </a>
              <Link
                href="/fleet/documents"
                className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                {t(locale, "pages.reminders.documents")}
              </Link>
            </div>
          </div>
        }
        filters={
          <form
            key={filterFormKey(sp)}
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
          >
            {sp.status?.trim() ? <input type="hidden" name="status" value={sp.status.trim()} /> : null}
            <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "common.filters.registrationNumber")}</label>
              <input
                name="registrationNumber"
                defaultValue={sp.registrationNumber ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[8rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "common.filters.client")}</label>
              <input
                name="clientId"
                defaultValue={sp.clientId ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[9rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "pages.reminders.type")}</label>
              <select
                name="sourceType"
                defaultValue={sp.sourceType ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">{t(locale, "common.filters.all")}</option>
                <option value="document">Document</option>
                <option value="maintenance">Mentenanță</option>
                <option value="cost">Cost</option>
                <option value="custom">Personalizat</option>
              </select>
            </div>
            <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">{t(locale, "common.filters.search")}</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder={t(locale, "pages.reminders.searchPlaceholder")}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
              {t(locale, "common.actions.apply")}
            </button>
            <FilterResetLink href="/fleet/reminders" />
          </form>
        }
        toolbar={
          <Suspense fallback={null}>
            <RemindersStatusToolbar write={write} />
          </Suspense>
        }
      >
        <DriverLicenseAlertsStrip alerts={licenseAlerts} />
        <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă…</p>}>
          <RemindersListView backHref="/fleet/vehicles" write={write} showStatusToolbar={false} />
        </Suspense>
      </FleetListPageLayout>
    </FleetPageMain>
  );

  if (!driverPortal) return desktop;

  const driverId = driverIdFromAuth(auth);
  const currentVehicleId = await resolveCurrentVehicleId(driverId);
  const status =
    sp.status === "action" || sp.status === "upcoming" || sp.status === "expired" ? sp.status : "all";
  const bandHref = (next: string) => (next === "all" ? "/fleet/reminders" : `/fleet/reminders?status=${next}`);

  const mobile = (
    <FleetPageMain narrow="sm">
      <h1 className="text-2xl font-semibold tracking-tight">{t(locale, "driverLists.reminders")}</h1>
      <DriverStatusBand
        items={[
          { href: bandHref("all"), label: t(locale, "driverLists.all"), active: status === "all" },
          { href: bandHref("action"), label: t(locale, "driver.home.attention"), active: status === "action" },
          { href: bandHref("upcoming"), label: t(locale, "driverLists.upcoming"), active: status === "upcoming" },
          { href: bandHref("expired"), label: t(locale, "driverLists.expired"), active: status === "expired" },
        ]}
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă…</p>}>
        <RemindersListView
          backHref="/fleet/vehicles"
          write={false}
          showStatusToolbar={false}
          vehicleId={currentVehicleId ?? undefined}
        />
      </Suspense>
    </FleetPageMain>
  );

  return <DriverViewportSplit mobile={mobile} desktop={desktop} />;
}
