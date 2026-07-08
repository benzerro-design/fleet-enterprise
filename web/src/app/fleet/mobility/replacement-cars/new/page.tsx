import Link from "next/link";
import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { MobilityAssignmentForm } from "@/components/fleet/MobilityAssignmentForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { WorkOrderDetail } from "@/lib/work-orders-api";
import { redirect } from "next/navigation";

type Search = { wo?: string; workOrderId?: string };

async function loadWorkOrder(id: string): Promise<WorkOrderDetail | null> {
  try {
    const res = await fleetServerFetch(`/work-orders/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderDetail;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<Search> };

export default async function NewReplacementCarPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/mobility/replacement-cars");

  const woId = sp.wo?.trim() || sp.workOrderId?.trim() || "";
  const wo = woId ? await loadWorkOrder(woId) : null;

  return (
    <FleetPageMain>
      <Link href="/fleet/mobility/replacement-cars" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Mașini la schimb
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Alocare mașină la schimb</h1>
      {!woId ? (
        <p className="mt-4 text-sm text-amber-300">
          Deschide formularul din comanda service (banner mobilitate) sau adaugă{" "}
          <code className="text-zinc-300">?wo=ID_COMANDA</code> în URL.
        </p>
      ) : null}
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă formularul…</p>}>
          <MobilityAssignmentForm
            workOrderId={woId || undefined}
            prefill={
              wo
                ? {
                    coveredVehicleReg: wo.registrationNumber,
                    workOrderDisplayNumber: wo.displayNumber,
                  }
                : undefined
            }
          />
        </Suspense>
      </div>
    </FleetPageMain>
  );
}
