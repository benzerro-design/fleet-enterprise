import { fleetServerFetch } from "@/lib/fleet-server";
import {
  fallbackServiceCatalog,
  type SupplierServiceCatalogEntry,
} from "@/lib/supplier-service-catalog";

/** Server components — catalog din API Nest. */
export async function loadSupplierServiceCatalogServer(): Promise<SupplierServiceCatalogEntry[]> {
  try {
    const res = await fleetServerFetch("/suppliers/catalog/services");
    if (!res?.ok) return fallbackServiceCatalog();
    return (await res.json()) as SupplierServiceCatalogEntry[];
  } catch {
    return fallbackServiceCatalog();
  }
}
