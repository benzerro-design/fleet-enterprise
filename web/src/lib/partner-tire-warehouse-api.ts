export type TireWarehouseRow = {
  id: string;
  tenantId: string;
  supplierId: string;
  code: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TireWarehouseZoneRow = {
  id: string;
  tenantId: string;
  warehouseId: string;
  code: string;
  name: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TireWarehouseShelfRow = {
  id: string;
  tenantId: string;
  zoneId: string;
  code: string;
  name: string | null;
  qrPayload: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TireWarehouseShelfLabel = {
  shelfId: string;
  code: string;
  zoneCode: string;
  warehouseCode: string;
  warehouseName: string;
  qrPayload: string;
  labelText: string;
};

function apiMessage(res: Response, data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return res.statusText || `HTTP ${res.status}`;
}

function supplierQuery(supplierId: string | undefined): string {
  return supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : "";
}

export async function fetchWarehouses(supplierId: string | undefined): Promise<TireWarehouseRow[]> {
  const res = await fetch(`/api/partner/tire-warehouse/warehouses${supplierQuery(supplierId)}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseRow[];
}

export async function createWarehouse(
  supplierId: string,
  body: { code: string; name?: string; addressLine?: string; city?: string },
): Promise<TireWarehouseRow> {
  const res = await fetch("/api/partner/tire-warehouse/warehouses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supplierId, ...body }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseRow;
}

export async function fetchZones(warehouseId: string): Promise<TireWarehouseZoneRow[]> {
  const res = await fetch(`/api/partner/tire-warehouse/warehouses/${encodeURIComponent(warehouseId)}/zones`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseZoneRow[];
}

export async function createZone(
  warehouseId: string,
  body: { code: string; name?: string; sortOrder?: number },
): Promise<TireWarehouseZoneRow> {
  const res = await fetch(
    `/api/partner/tire-warehouse/warehouses/${encodeURIComponent(warehouseId)}/zones`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseZoneRow;
}

export async function fetchShelves(zoneId: string): Promise<TireWarehouseShelfRow[]> {
  const res = await fetch(`/api/partner/tire-warehouse/zones/${encodeURIComponent(zoneId)}/shelves`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseShelfRow[];
}

export async function createShelf(
  zoneId: string,
  body: { code: string; name?: string },
): Promise<TireWarehouseShelfRow> {
  const res = await fetch(`/api/partner/tire-warehouse/zones/${encodeURIComponent(zoneId)}/shelves`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseShelfRow;
}

export async function fetchShelfLabel(shelfId: string): Promise<TireWarehouseShelfLabel> {
  const res = await fetch(`/api/partner/tire-warehouse/shelves/${encodeURIComponent(shelfId)}/label`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseShelfLabel;
}
