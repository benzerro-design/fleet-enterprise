import { redirect } from "next/navigation";
import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SupplierOnboardingWizard } from "@/components/fleet/suppliers/SupplierOnboardingWizard";
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
      <p className="mt-2 max-w-xl text-sm text-zinc-400">
        Wizard onboarding: identitate (CUI/IBAN) → categorie → program atelier.
      </p>
      <div className="mt-8">
        <SupplierOnboardingWizard serviceCatalog={serviceCatalog} />
      </div>
    </FleetPageMain>
  );
}
