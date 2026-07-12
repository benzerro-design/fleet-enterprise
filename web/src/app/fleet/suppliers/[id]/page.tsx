import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { supplierCategoryLabel, supplierStatusLabel, type SupplierRecord } from "@/lib/suppliers-api";
import { supplierServiceLabel } from "@/lib/supplier-service-catalog";

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
  const [supplier, auth] = await Promise.all([load(id), getAuthMeResult()]);
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
        {write ? (
          <Link
            href={`/fleet/suppliers/${supplier.id}/edit`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Editare
          </Link>
        ) : null}
      </div>
      <dl className="mt-8 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500">CUI</dt>
          <dd className="mt-1 font-mono text-sm">{supplier.taxId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Comenzi service</dt>
          <dd className="mt-1 text-sm">{supplier.workOrderCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Email</dt>
          <dd className="mt-1 text-sm">{supplier.contactEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Telefon</dt>
          <dd className="mt-1 text-sm">{supplier.contactPhone ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-zinc-500">Adresă</dt>
          <dd className="mt-1 text-sm">
            {[supplier.addressLine, supplier.city, supplier.county].filter(Boolean).join(", ") || "—"}
          </dd>
        </div>
        {supplier.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500">Notițe</dt>
            <dd className="mt-1 text-sm text-zinc-300">{supplier.notes}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-semibold text-zinc-200">Servicii prestate</h2>
        {supplier.services?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {supplier.services.map((s) => (
              <span
                key={s}
                className="rounded-full border border-violet-800/50 bg-violet-950/30 px-3 py-1 text-xs text-violet-200"
              >
                {supplierServiceLabel(s)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Niciun serviciu configurat.</p>
        )}
      </div>
    </FleetPageMain>
  );
}
