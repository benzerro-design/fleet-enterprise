import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DriverForm } from "@/components/fleet/DriverForm";
import { canWriteFleetOps, defaultClientCodeForTickets, getAuthMeResult } from "@/lib/auth-server";

export default async function NewDriverPage() {
  const auth = await getAuthMeResult();
  if (!canWriteFleetOps(auth)) redirect("/fleet/drivers");
  const defaultClient = defaultClientCodeForTickets(auth);

  return (
    <FleetPageMain narrow="sm">
      <div className="mb-8">
        <Link href="/fleet/drivers" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Șoferi
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Șofer nou</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă formularul…</p>}>
        <DriverForm mode="create" defaultClientCode={defaultClient} lockClient={Boolean(defaultClient)} />
      </Suspense>
    </FleetPageMain>
  );
}
