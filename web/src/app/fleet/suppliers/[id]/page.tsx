import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SupplierProfileTabs } from "@/components/fleet/suppliers/SupplierProfileTabs";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { loadSupplierServiceCatalogServer } from "@/lib/suppliers-api-server";
import { supplierCategoryLabel, supplierStatusLabel, type SupplierRecord } from "@/lib/suppliers-api";

async function load(id: string): Promise<SupplierRecord | null> {
  try {
    const res = await fleetServerFetch(`/suppliers/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as SupplierRecord;
  } catch {
    return null;
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [supplier, auth, serviceCatalog] = await Promise.all([
    load(id),
    getAuthMeResult(),
    loadSupplierServiceCatalogServer(),
  ]);
  if (!supplier) notFound();
  const write = canManageFleet(auth);

  return (
    <FleetPageMain>
      <Link href="/fleet/suppliers" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Furnizori
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-sky-400">{supplier.code}</p>
          <h1 className="mt-1 text-3xl font-semibold">{supplier.legalName}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {supplierCategoryLabel(supplier.category)} · {supplierStatusLabel(supplier.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/fleet/partner?supplierId=${supplier.id}`}
            className="rounded-lg border border-violet-800/50 px-4 py-2 text-sm text-violet-300 hover:bg-violet-950/30"
          >
            Portal view-as
          </Link>
          {write ? (
            <Link
              href={`/fleet/suppliers/${supplier.id}/edit`}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Editare
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <SupplierProfileTabs
          supplier={supplier}
          serviceCatalog={serviceCatalog}
          canWriteServices={write}
          assignedByLabel="Flotă"
        />
      </div>
    </FleetPageMain>
  );
}
