import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DriverForm } from "@/components/fleet/DriverForm";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
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

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/drivers");

  const driver = await loadDriver(id);
  if (!driver) notFound();

  return (
    <FleetPageMain narrow="sm">
      <div className="mb-8">
        <Link href={`/fleet/drivers/${driver.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          ← {driver.fullName}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Editare șofer</h1>
      </div>
      <DriverForm mode="edit" initial={driver} />
    </FleetPageMain>
  );
}
