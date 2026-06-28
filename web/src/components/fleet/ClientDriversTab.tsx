import Link from "next/link";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { driverStatusLabel, type DriverRecord } from "@/lib/drivers-api";

type Props = {
  clientCode: string;
  drivers: DriverRecord[];
  canWrite: boolean;
};

export function ClientDriversTab({ clientCode, drivers, canWrite }: Props) {
  if (drivers.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500">Niciun șofer înregistrat pentru acest client.</p>
        {canWrite ? (
          <Link
            href={`/fleet/drivers/new?client=${encodeURIComponent(clientCode)}`}
            className="inline-flex w-fit rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-emerald-400 hover:bg-zinc-800"
          >
            Adaugă șofer
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Link
            href="/fleet/drivers/new"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Șofer nou
          </Link>
        </div>
      ) : null}
      <FleetDataTable>
        <table className={fleetTableClass}>
          <thead className={fleetTheadClass}>
            <tr>
              <th className={fleetThClass}>Nume</th>
              <th className={fleetThClass}>Status</th>
              <th className={fleetThClass}>Vehicule active</th>
              <th className={fleetThClass}>Telefon</th>
              <th className={fleetThClass} />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {drivers.map((d) => (
              <tr key={d.id} className="text-zinc-200">
                <td className={fleetTdClass}>
                  <Link href={`/fleet/drivers/${d.id}`} className="font-medium text-emerald-400 hover:underline">
                    {d.fullName}
                  </Link>
                </td>
                <td className={fleetTdClass}>{driverStatusLabel(d.status)}</td>
                <td className={`${fleetTdClass} font-mono text-sm text-zinc-400`}>
                  {d.activeVehicleRegistrations.length > 0 ? d.activeVehicleRegistrations.join(", ") : "—"}
                </td>
                <td className={`${fleetTdClass} text-zinc-400`}>{d.phone ?? "—"}</td>
                <td className={`${fleetTdClass} text-right`}>
                  <Link href={`/fleet/drivers/${d.id}`} className="text-zinc-400 hover:text-zinc-200 hover:underline">
                    Detalii
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FleetDataTable>
      <p className="text-xs text-zinc-600">
        <Link href="/fleet/drivers" className="text-emerald-500/80 hover:underline">
          Vezi toți șoferii →
        </Link>
      </p>
    </div>
  );
}
