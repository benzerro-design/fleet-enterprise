export type PartnerSupplierOverviewRow = {
  id: string;
  code: string;
  legalName: string;
  status: "active" | "inactive" | "blocked";
  open: number;
  pendingApproval: number;
  readyUninvoiced: number;
  appointmentsThisWeek: number;
};

export type PartnerAdminOverview = {
  totals: {
    open: number;
    pendingApproval: number;
    readyUninvoiced: number;
    appointmentsThisWeek: number;
    supplierCount: number;
  };
  suppliers: PartnerSupplierOverviewRow[];
};

export const partnerAdminBrowserBase = "/api/partner/admin";
