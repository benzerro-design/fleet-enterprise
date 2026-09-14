export type ClientInviteStatus = "pending" | "accepted" | "expired";

export type ClientInviteRecord = {
  id: string;
  email: string;
  clientId: string | null;
  clientCode?: string | null;
  clientLegalName?: string | null;
  clientRole: string | null;
  inviteUrl: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  createdByEmail?: string | null;
  status: ClientInviteStatus;
};

export function inviteStatusLabel(status: ClientInviteStatus): string {
  switch (status) {
    case "accepted":
      return "Acceptată";
    case "expired":
      return "Expirată";
    default:
      return "În așteptare";
  }
}

export function inviteRoleLabel(role: string | null): string {
  switch (role) {
    case "client_admin":
      return "Administrator client (L1)";
    case "client_dispatcher":
      return "Dispecer (L1)";
    case "client_viewer":
      return "Doar citire";
    case "driver":
      return "Șofer (L0)";
    default:
      return role ?? "echipă";
  }
}
