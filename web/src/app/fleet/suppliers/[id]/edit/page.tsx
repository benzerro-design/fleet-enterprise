import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SupplierForm } from "@/components/fleet/SupplierForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { SupplierRecord } from "@/lib/suppliers-api";

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

export default async function EditSupplierPage({ params }: PageProps) {
  const { id } = await params;
  const [supplier, auth] = await Promise.all([load(id), getAuthMeResult()]);
  if (!canManageFleet(auth)) redirect("/fleet/suppliers");
  if (!supplier) notFound();

  return (
    <FleetPageMain>
      <Link href={`/fleet/suppliers/${supplier.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
        ← {supplier.legalName}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Editare furnizor</h1>
      <div className="mt-8">
        <SupplierForm mode="edit" initial={supplier} />
      </div>
    </FleetPageMain>
  );
}
