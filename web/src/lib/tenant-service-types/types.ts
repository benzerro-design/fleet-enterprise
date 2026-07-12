export type TenantServiceType = {
  id: string;
  code: string;
  label: string;
  clientDescription: string;
  sortOrder: number;
  active: boolean;
  system: boolean;
  usedBySuppliers: number;
  usedByTickets: number;
  createdAt: string;
  updatedAt: string;
};

export type TenantServiceTypesResponse = {
  items: TenantServiceType[];
};

export type CreateTenantServiceTypeInput = {
  code: string;
  label: string;
  clientDescription?: string;
};

export type PatchTenantServiceTypeInput = {
  label?: string;
  clientDescription?: string;
  active?: boolean;
  sortOrder?: number;
};
