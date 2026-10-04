import type { FleetMobileTab, FleetNavEntry, FleetNavGroup, FleetNavLink } from "@/lib/fleet-nav";
import { t } from "@/lib/i18n/t";
import type { Locale } from "@/lib/i18n/types";

const SOON_LABEL_KEYS: Record<string, string> = {
  "Tracking / Hartă": "nav.soon.trackingMap",
  "Contracte / SLA": "nav.soon.contracts",
  "Facturi & plăți": "nav.soon.invoices",
  "Rapoarte financiare": "nav.soon.financialReports",
  "Export contabilitate": "nav.soon.accountingExport",
  "Vignete / eTransport": "nav.soon.eTransport",
  "RAR / DRPCIV": "nav.soon.authorities",
  "Flotă pool": "nav.soon.poolFleet",
};

function groupLabelKey(group: FleetNavGroup): string {
  if (group.id === "clients" && group.label === "Solicitări") return "nav.driverGroups.requests";
  if (group.id === "suppliers" && group.label === "Comenzi") return "nav.driverGroups.orders";
  return `nav.groups.${group.id}`;
}

function linkLabelKey(entry: FleetNavLink): string {
  if (entry.href === "/fleet/vehicles" && entry.label === "Acasă") {
    return "nav.driverLinks.vehicleHome";
  }
  return `nav.links.${entry.href}`;
}

function mobileTabLabelKey(tab: FleetMobileTab): string {
  if (tab.openMenu) return "nav.mobileTabs.more";
  if (tab.href === "/fleet/dashboard") return "nav.mobileTabs.home";
  if (tab.href === "/fleet/vehicles" && tab.label === "Acasă") return "nav.mobileTabs.home";
  if (tab.href === "/fleet/vehicles") return "nav.mobileTabs.vehicles";
  if (tab.href === "/fleet/trips") return "nav.mobileTabs.trips";
  if (tab.href === "/fleet/tickets") return "nav.mobileTabs.tickets";
  if (tab.href === "/fleet/reminders") return "nav.mobileTabs.reminders";
  if (tab.href === "/fleet/costs" && (tab.label === "Alimentare" || tab.label === "Fuel")) {
    return "nav.mobileTabs.fueling";
  }
  if (tab.href === "/fleet/costs") return "nav.links./fleet/costs";
  return "";
}

export function localizeFleetNavEntry(locale: Locale, entry: FleetNavEntry): FleetNavEntry {
  if (entry.kind === "link") {
    const key = linkLabelKey(entry);
    return { ...entry, label: t(locale, key) };
  }
  const key = SOON_LABEL_KEYS[entry.label];
  return key ? { ...entry, label: t(locale, key) } : entry;
}

export function localizeFleetNavGroup(locale: Locale, group: FleetNavGroup): FleetNavGroup {
  return {
    ...group,
    label: t(locale, groupLabelKey(group)),
    items: group.items.map((entry) => localizeFleetNavEntry(locale, entry)),
  };
}

export function localizeFleetMobileTabs(locale: Locale, tabs: FleetMobileTab[]): FleetMobileTab[] {
  return tabs.map((tab) => {
    const key = mobileTabLabelKey(tab);
    return key ? { ...tab, label: t(locale, key) } : tab;
  });
}
