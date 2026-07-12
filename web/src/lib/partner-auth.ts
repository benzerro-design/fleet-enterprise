import type { SupplierMembershipMe } from "./auth-server";

export function supplierRoleLabel(role: SupplierMembershipMe["role"]): string {
  switch (role) {
    case "supplier_manager":
      return "Manager furnizor";
    case "supplier_staff":
      return "Personal service";
    case "supplier_accountant":
      return "Contabilitate furnizor";
    default:
      return "Partener";
  }
}

export function primarySupplierMembership(me: {
  access?: { supplierMemberships?: SupplierMembershipMe[] };
}): SupplierMembershipMe | undefined {
  return me.access?.supplierMemberships?.[0];
}

export function userInitialsFromEmail(email?: string): string {
  if (!email) return "??";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function partnerPendingTotal(stats?: {
  pendingApproval?: number;
  readyUninvoiced?: number;
} | null): number {
  if (!stats) return 0;
  return (stats.pendingApproval ?? 0) + (stats.readyUninvoiced ?? 0);
}
