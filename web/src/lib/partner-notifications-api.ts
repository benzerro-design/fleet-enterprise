export const partnerNotificationsBrowserBase = "/api/partner/notifications";

export type PartnerNotificationRecord = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
  sentAt: string | null;
};

export type PartnerNotificationListPayload = {
  items: PartnerNotificationRecord[];
  unreadCount: number;
};

export function partnerNotificationKindLabel(kind: string): string {
  switch (kind) {
    case "wo_created":
      return "Comandă nouă";
    case "quote_submitted":
      return "Deviz trimis";
    case "quote_approved":
      return "Deviz aprobat";
    case "quote_rejected":
      return "Deviz respins";
    case "appointment_confirmed":
      return "Programare";
    case "invoice_recorded":
      return "Factură";
    default:
      return "Notificare";
  }
}
