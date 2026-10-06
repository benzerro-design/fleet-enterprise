import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DriverForm } from "@/components/fleet/DriverForm";
import { DriverViewportSplit } from "@/components/fleet/DriverViewportSplit";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import {
  driverIdFromAuth,
  getAuthMeResult,
  isClientDriverPortal,
} from "@/lib/auth-server";
import type { DriverRecord } from "@/lib/drivers-api";
import { fleetServerFetch } from "@/lib/fleet-server";

async function loadDriver(id: string): Promise<DriverRecord | null> {
  try {
    const res = await fleetServerFetch(`/drivers/${id}`);
    if (!res?.ok) return null;
    const data = (await res.json()) as { driver: DriverRecord };
    return data.driver;
  } catch {
    return null;
  }
}

export default async function DriverSelfProfileEditPage() {
  const auth = await getAuthMeResult();
  if (!isClientDriverPortal(auth)) redirect("/fleet/vehicles");
  const id = driverIdFromAuth(auth);
  if (!id) redirect("/fleet/vehicles");

  const driver = await loadDriver(id);
  if (!driver) notFound();

  const form = <DriverForm mode="edit" initial={driver} lockClient returnHref="/fleet/profile" />;

  const desktop = (
    <FleetPageMain>
      <div className="mb-8">
        <Link href="/fleet/profile" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Profil șofer
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Editare profil</h1>
      </div>
      {form}
    </FleetPageMain>
  );

  const mobile = (
    <FleetPageMain narrow="sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/fleet/profile" className="text-sm text-zinc-400">
          ← Înapoi
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Editare profil</h1>
      </div>
      {form}
    </FleetPageMain>
  );

  return <DriverViewportSplit mobile={mobile} desktop={desktop} />;
}
