import type { TireMountedAs, VehicleTireSeason } from "@/lib/vehicle-wheels-types";
import type { TireLedgerMovement } from "@/components/fleet/TireMovementLedger";

export type CustodyWarehouseLocation = {
  id: string;
  code: string;
  row: {
    code: string;
    zone: {
      code: string;
      warehouse: { code: string; name: string };
    };
  };
};

export type CustodyStockItem = {
  assetId: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  season: VehicleTireSeason;
  dot: string | null;
  treadMm: number | null;
  serialOrQr: string | null;
};

export type CustodyStockRow = {
  id: string;
  checkInAt: string;
  locationCode: string | null;
  feeCents: number | null;
  warehouseLocationId: string | null;
  location: CustodyWarehouseLocation | null;
  locationLabel: string;
  suggestedLocationId: string | null;
  suggestedLocationLabel: string | null;
  set: {
    id: string;
    name: string | null;
    season: VehicleTireSeason;
    mountedAs: TireMountedAs;
    itemCount: number;
    plate: string;
    clientName: string;
  };
  items: CustodyStockItem[];
};

export type CustodyAssetFiche = {
  asset: CustodyStockItem;
  placement: {
    kind: string;
    locationCode: string | null;
    supplierName: string | null;
    plate: string | null;
  } | null;
  stayLocation: {
    stayId: string;
    locationCode: string | null;
    warehouseLocationId: string | null;
    location: CustodyWarehouseLocation | null;
    locationLabel: string | null;
  } | null;
  set: {
    id: string;
    mountedAs: TireMountedAs;
  } | null;
  movements: TireLedgerMovement[];
};

function qsSupplier(supplierId?: string): string {
  const p = new URLSearchParams();
  if (supplierId) p.set("supplierId", supplierId);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function fetchCustodyStock(
  supplierId: string | undefined,
  q?: string,
): Promise<CustodyStockRow[]> {
  const p = new URLSearchParams();
  if (supplierId) p.set("supplierId", supplierId);
  if (q?.trim()) p.set("q", q.trim());
  const res = await fetch(`/api/partner/tire-custody/stock?${p.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { items?: CustodyStockRow[] };
  return data.items ?? [];
}

export async function assignCustodyLocation(
  stayId: string,
  locationId: string,
  supplierId?: string,
): Promise<void> {
  const res = await fetch(`/api/partner/tire-custody/stock/${encodeURIComponent(stayId)}/assign-location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId, ...(supplierId ? { supplierId } : {}) }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
}

export async function fetchCustodyAssetFiche(
  assetId: string,
  supplierId?: string,
): Promise<CustodyAssetFiche> {
  const res = await fetch(
    `/api/partner/tire-custody/assets/${encodeURIComponent(assetId)}${qsSupplier(supplierId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CustodyAssetFiche;
}

export async function patchCustodyAssetTread(
  assetId: string,
  body: { treadMm: number; note?: string; supplierId?: string },
  supplierId?: string,
): Promise<CustodyAssetFiche> {
  const sid = body.supplierId ?? supplierId;
  const res = await fetch(
    `/api/partner/tire-custody/assets/${encodeURIComponent(assetId)}${qsSupplier(sid)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treadMm: body.treadMm,
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(sid ? { supplierId: sid } : {}),
      }),
    },
  );
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join("; ");
    } catch {
      msg = await res.text().catch(() => "");
    }
    throw new Error(msg || `Nu s-a putut salva profilul (HTTP ${res.status})`);
  }
  return (await res.json()) as CustodyAssetFiche;
}
