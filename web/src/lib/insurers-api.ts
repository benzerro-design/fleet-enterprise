import { fleetJsonHeaders } from "@/lib/fleet-api";

export const insurersBrowserBase = "/api/insurers";

export type InsurerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InsurerListPayload = {
  items: InsurerRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export { fleetJsonHeaders };
