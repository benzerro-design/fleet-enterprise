import { redirect } from "next/navigation";
import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SupplierForm } from "@/components/fleet/SupplierForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { loadSupplierServiceCatalogServer } from "@/lib/suppliers-api-server";

export default async function NewSupplierPage() {
  const [auth, serviceCatalog] = await Promise.all([getAuthMeResult(), loadSupplierServiceCatalogServer()]);
  if (!canManageFleet(auth)) redirect("/fleet/suppliers");
  return (
    <FleetPageMain>
      <Link href="/fleet/suppliers" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Furnizori
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Furnizor nou</h1>
      <div className="mt-8">
        <SupplierForm mode="create" serviceCatalog={serviceCatalog} />
      </div>
    </FleetPageMain>
  );
}
