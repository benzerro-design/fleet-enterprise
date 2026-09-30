import { notFound, redirect } from "next/navigation";
import { SupplierProfileShell } from "@/components/fleet/suppliers/SupplierProfileShell";
import { canManageFleet, canReadSuppliers, getAuthMeResult, getDefaultFleetHome } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { loadSupplierServiceCatalogServer } from "@/lib/suppliers-api-server";
import { type SupplierRecord } from "@/lib/suppliers-api";

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
  if (!canReadSuppliers(auth)) redirect(getDefaultFleetHome(auth));
  const write = canManageFleet(auth);

  return (
    <SupplierProfileShell
      mode="fleet"
      supplier={supplier}
      serviceCatalog={serviceCatalog}
      canEdit={write}
      canWriteServices={write}
      canAllocateClients={write}
      canInviteTeam={write}
      allowManagerInvite={write}
      assignedByLabel="Flotă"
    />
  );
}
