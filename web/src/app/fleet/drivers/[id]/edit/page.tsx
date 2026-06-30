import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DriverForm } from "@/components/fleet/DriverForm";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
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
  if (!canWriteFleetOps(auth)) redirect("/fleet/drivers");

  const driver = await loadDriver(id);
  if (!driver) notFound();

  return (
    <FleetPageMain>
      <div className="mb-8">
        <Link href={`/fleet/drivers/${driver.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          ← {driver.fullName}
        </Link>
      </div>
      <DriverForm mode="edit" initial={driver} />
    </FleetPageMain>
  );
}
