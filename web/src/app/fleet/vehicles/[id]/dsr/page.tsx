import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { VehicleDsrTab } from "@/components/fleet/VehicleDsrTab";
import { VehicleDsrPrintButton } from "@/components/fleet/VehicleDsrPrintButton";
import { loadVehicleDetail } from "@/lib/vehicle-detail-server";

type PageProps = { params: Promise<{ id: string }> };

export default async function VehicleDsrPage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadVehicleDetail(id);
  if (!data) notFound();

  return (
    <FleetPageMain>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/fleet/vehicles/${id}?tab=dsr`} className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Înapoi la vehicul
        </Link>
        <VehicleDsrPrintButton />
      </div>
      <VehicleDsrTab
        vehicle={data.vehicle}
        maintenance={data.maintenanceList}
        equipment={data.equipmentPayload}
        printHref={`/fleet/vehicles/${id}/dsr`}
      />
    </FleetPageMain>
  );
}
