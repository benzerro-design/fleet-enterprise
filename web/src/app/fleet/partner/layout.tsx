import { redirect } from "next/navigation";
import { PartnerAdminBanner } from "@/components/fleet/partner/PartnerAdminChrome";
import { PartnerShell } from "@/components/fleet/partner/PartnerShell";
import {
  canAccessPartnerPortal,
  getAuthMeResult,
  isPartnerAdminMode,
} from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  partnerPendingTotal,
  primarySupplierMembership,
  supplierRoleLabel,
  userInitialsFromEmail,
} from "@/lib/partner-auth";
import type { SupplierListPayload } from "@/lib/suppliers-api";
import type { WorkOrderStats } from "@/lib/work-orders-api";
import type { AppointmentStats } from "@/lib/appointments-api";

async function loadStats(): Promise<WorkOrderStats | null> {
  try {
    const res = await fleetServerFetch("/work-orders/stats");
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderStats;
  } catch {
    return null;
  }
}

async function loadAppointmentStats(): Promise<AppointmentStats | null> {
  try {
    const res = await fleetServerFetch("/appointments/stats");
    if (!res?.ok) return null;
    return (await res.json()) as AppointmentStats;
  } catch {
    return null;
  }
}

async function loadAdminSuppliers(): Promise<SupplierListPayload["items"]> {
  try {
    const res = await fleetServerFetch("/suppliers?status=active&pageSize=200");
    if (!res?.ok) return [];
    const payload = (await res.json()) as SupplierListPayload;
    return payload.items;
  } catch {
    return [];
  }
}

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthMeResult();
  if (!auth.ok) {
    redirect("/login?next=/fleet/partner");
  }
  if (!canAccessPartnerPortal(auth)) {
    redirect("/fleet/dashboard");
  }

  const adminMode = isPartnerAdminMode(auth);
  const supplierMembership = adminMode ? undefined : primarySupplierMembership(auth.me);
  const adminSuppliers = adminMode ? await loadAdminSuppliers() : [];
  const [stats, apptStats] = adminMode
    ? [null, null]
    : await Promise.all([loadStats(), loadAppointmentStats()]);
  const pending = partnerPendingTotal(stats, apptStats);

  const topBar = {
    pageTitle: "Portal partener",
    supplierLegalName: adminMode
      ? "Toți furnizorii"
      : (supplierMembership?.supplierLegalName ?? "Furnizor"),
    supplierCode: adminMode ? "ADMIN" : (supplierMembership?.supplierCode ?? "—"),
    tenantSlug: auth.me.tenantSlug,
    userEmail: auth.me.email,
    userInitials: userInitialsFromEmail(auth.me.email),
    supplierRoleLabel: adminMode
      ? "Administrator tenant"
      : supplierMembership
        ? supplierRoleLabel(supplierMembership.role)
        : "Partener",
    docAlert: !adminMode,
    docAlertTitle: "Autorizație ITP expiră în curând",
    notificationCount: pending > 0 ? pending : undefined,
    pendingTotal: pending > 0 ? pending : undefined,
    isAdminMode: adminMode,
    adminSuppliers: adminSuppliers.map((s) => ({
      id: s.id,
      code: s.code,
      legalName: s.legalName,
    })),
  };

  const supplierFooter = adminMode
    ? `${adminSuppliers.length} furnizori activi · mod admin`
    : supplierMembership
      ? `${supplierMembership.supplierLegalName} · ${supplierMembership.supplierCode}`
      : undefined;

  const authBanner = adminMode ? (
    <PartnerAdminBanner adminEmail={auth.me.email} />
  ) : undefined;

  return (
    <PartnerShell topBar={topBar} supplierFooter={supplierFooter} authBanner={authBanner}>
      {children}
    </PartnerShell>
  );
}
