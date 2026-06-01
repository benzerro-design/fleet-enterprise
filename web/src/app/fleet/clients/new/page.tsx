import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientForm } from "@/components/fleet/ClientForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";

export default async function NewClientPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/clients");

  return (
    <FleetPageMain narrow="sm">
      <div className="mb-8">
        <Link href="/fleet/clients" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Clienți
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Client nou</h1>
      </div>
      <ClientForm mode="create" />
    </FleetPageMain>
  );
}
