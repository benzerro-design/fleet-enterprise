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

export type TireWarehouseStorageRow = {
  id: string;
  tenantId: string;
  zoneId: string;
  code: string;
  name: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TireWarehouseLocationRow = {
  id: string;
  tenantId: string;
  rowId: string;
  code: string;
  name: string | null;
  qrPayload: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TireWarehouseLocationLabel = {
  locationId: string;
  code: string;
  rowCode: string;
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

export async function fetchRows(zoneId: string): Promise<TireWarehouseStorageRow[]> {
  const res = await fetch(`/api/partner/tire-warehouse/zones/${encodeURIComponent(zoneId)}/rows`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseStorageRow[];
}

export async function createRow(
  zoneId: string,
  body: { code: string; name?: string; sortOrder?: number },
): Promise<TireWarehouseStorageRow> {
  const res = await fetch(`/api/partner/tire-warehouse/zones/${encodeURIComponent(zoneId)}/rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseStorageRow;
}

export async function patchRow(
  rowId: string,
  body: { name?: string | null; active?: boolean; zoneId?: string; sortOrder?: number },
): Promise<TireWarehouseStorageRow> {
  const res = await fetch(`/api/partner/tire-warehouse/rows/${encodeURIComponent(rowId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseStorageRow;
}

export async function patchZone(
  zoneId: string,
  body: { name?: string | null; active?: boolean; sortOrder?: number },
): Promise<TireWarehouseZoneRow> {
  const res = await fetch(`/api/partner/tire-warehouse/zones/${encodeURIComponent(zoneId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseZoneRow;
}

export async function patchLocation(
  locationId: string,
  body: { name?: string | null; active?: boolean },
): Promise<TireWarehouseLocationRow> {
  const res = await fetch(`/api/partner/tire-warehouse/locations/${encodeURIComponent(locationId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseLocationRow;
}

export async function fetchLocations(rowId: string): Promise<TireWarehouseLocationRow[]> {
  const res = await fetch(`/api/partner/tire-warehouse/rows/${encodeURIComponent(rowId)}/locations`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseLocationRow[];
}

export async function createLocation(
  rowId: string,
  body: { code: string; name?: string },
): Promise<TireWarehouseLocationRow> {
  const res = await fetch(`/api/partner/tire-warehouse/rows/${encodeURIComponent(rowId)}/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseLocationRow;
}

export async function fetchLocationLabel(locationId: string): Promise<TireWarehouseLocationLabel> {
  const res = await fetch(
    `/api/partner/tire-warehouse/locations/${encodeURIComponent(locationId)}/label`,
    {
      cache: "no-store",
    },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(res, data));
  return data as TireWarehouseLocationLabel;
}
