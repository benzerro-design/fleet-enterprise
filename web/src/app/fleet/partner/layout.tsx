import { redirect } from "next/navigation";
import { PartnerShell } from "@/components/fleet/partner/PartnerShell";
import { getAuthMeResult, isPartnerPortalUser } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  partnerPendingTotal,
  primarySupplierMembership,
  supplierRoleLabel,
  userInitialsFromEmail,
} from "@/lib/partner-auth";
import type { WorkOrderStats } from "@/lib/work-orders-api";

async function loadStats(): Promise<WorkOrderStats | null> {
  try {
    const res = await fleetServerFetch("/work-orders/stats");
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderStats;
  } catch {
    return null;
  }
}

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthMeResult();
  if (!auth.ok) {
    redirect("/login?next=/fleet/partner");
  }
  if (!isPartnerPortalUser(auth)) {
    redirect("/fleet/dashboard");
  }

  const supplier = primarySupplierMembership(auth.me);
  const stats = await loadStats();
  const pending = partnerPendingTotal(stats);

  const topBar = {
    pageTitle: "Portal partener",
    supplierLegalName: supplier?.supplierLegalName ?? "Furnizor",
    supplierCode: supplier?.supplierCode ?? "—",
    tenantSlug: auth.me.tenantSlug,
    userEmail: auth.me.email,
    userInitials: userInitialsFromEmail(auth.me.email),
    supplierRoleLabel: supplier ? supplierRoleLabel(supplier.role) : "Partener",
    docAlert: true,
    docAlertTitle: "Autorizație ITP expiră în curând",
    notificationCount: pending > 0 ? pending : undefined,
    pendingTotal: pending > 0 ? pending : undefined,
  };

  const supplierFooter = supplier
    ? `${supplier.supplierLegalName} · ${supplier.supplierCode}`
    : undefined;

  return (
    <PartnerShell topBar={topBar} supplierFooter={supplierFooter}>
      {children}
    </PartnerShell>
  );
}
