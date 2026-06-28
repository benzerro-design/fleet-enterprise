import Link from "next/link";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetThRightClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { DeleteTripButton } from "@/components/fleet/DeleteTripButton";
import { formatDateTimeRo } from "@/lib/datetime-local";
import type { DriverTripListPayload } from "@/lib/trips-api";

export type DriverTripsSearch = {
  page: number;
  startedFrom?: string;
  startedTo?: string;
  q?: string;
  ended?: string;
};

type Props = {
  driverId: string;
  data: DriverTripListPayload | null;
  canWrite: boolean;
  search: DriverTripsSearch;
};

function buildQuery(driverId: string, search: DriverTripsSearch, page?: number): string {
  const p = new URLSearchParams();
  p.set("tab", "trips");
  p.set("page", String(page ?? search.page));
  if (search.startedFrom?.trim()) p.set("startedFrom", search.startedFrom.trim());
  if (search.startedTo?.trim()) p.set("startedTo", search.startedTo.trim());
  if (search.q?.trim()) p.set("q", search.q.trim());
  if (search.ended === "open" || search.ended === "closed") p.set("ended", search.ended);
  return `/fleet/drivers/${driverId}?${p.toString()}`;
}

export function DriverTripsPanel({ driverId, data, canWrite, search }: Props) {
  const page = search.page;
  const pageSize = data?.pageSize ?? 20;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">Curse</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Toate cursele înregistrate pe acest șofer, indiferent de vehicul.
          </p>
        </div>
        <Link
          href={`/fleet/trips?driverId=${encodeURIComponent(driverId)}`}
          className="text-sm text-emerald-400 hover:underline"
        >
          Deschide în modul Curse →
        </Link>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
      >
        <input type="hidden" name="tab" value="trips" />
        <input type="hidden" name="page" value="1" />
        <div>
          <label className="text-xs text-zinc-500">Căutare</label>
          <input
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="Referință, origine, destinație…"
            className="mt-1 block min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Start de la</label>
          <input
            name="startedFrom"
            type="date"
            defaultValue={search.startedFrom ?? ""}
            className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Start până la</label>
          <input
            name="startedTo"
            type="date"
            defaultValue={search.startedTo ?? ""}
            className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Status</label>
          <select
            name="ended"
            defaultValue={search.ended ?? ""}
            className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Toate</option>
            <option value="open">Deschisă (fără stop)</option>
            <option value="closed">Închisă (cu stop)</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        >
          Filtrează
        </button>
        <FilterResetLink href={`/fleet/drivers/${driverId}?tab=trips`} />
      </form>

      {!data ? (
        <p className="text-sm text-amber-400">Nu am putut încărca cursele.</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nicio cursă găsită pentru acest șofer.</p>
      ) : (
        <>
          <FleetDataTable>
            <table className={fleetTableClass}>
              <thead className={fleetTheadClass}>
                <tr>
                  <th className={fleetThClass}>Ref</th>
                  <th className={fleetThClass}>Vehicul</th>
                  <th className={fleetThClass}>Start</th>
                  <th className={fleetThClass}>Stop</th>
                  <th className={fleetThClass}>Traseu</th>
                  <th className={fleetThClass}>Km</th>
                  <th className={fleetThRightClass}>Detaliu</th>
                  {canWrite ? <th className={fleetThRightClass}>Acțiuni</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.items.map((row) => (
                  <tr key={row.id} className="bg-zinc-900/30">
                    <td className={`${fleetTdClass} font-mono`}>{row.reference ?? "—"}</td>
                    <td className={fleetTdClass}>
                      <Link
                        href={`/fleet/vehicles/${row.vehicleId}`}
                        className="font-mono text-emerald-400 hover:underline"
                      >
                        {row.registrationNumber}
                      </Link>
                    </td>
                    <td className={fleetTdClass}>{formatDateTimeRo(row.startedAt)}</td>
                    <td className={fleetTdClass}>{formatDateTimeRo(row.endedAt)}</td>
                    <td className={`${fleetTdClass} max-w-[14rem] truncate text-sm text-zinc-400`}>
                      {[row.originLabel, row.destLabel].filter(Boolean).join(" → ") || "—"}
                    </td>
                    <td className={`${fleetTdClass} font-mono`}>{row.distanceKm ?? "—"}</td>
                    <td className={`${fleetTdClass} text-right`}>
                      <Link href={`/fleet/trips/${row.id}`} className="text-emerald-400 hover:underline">
                        Vezi
                      </Link>
                    </td>
                    {canWrite ? (
                      <td className={fleetTdClass}>
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                          <Link
                            href={`/fleet/trips/${row.id}/edit`}
                            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                          >
                            Editare
                          </Link>
                          <DeleteTripButton tripId={row.id} label={row.reference ?? row.id} />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </FleetDataTable>
          {total > pageSize ? (
            <div className="flex justify-between text-sm text-zinc-400">
              <span>
                Pagina {page} / {totalPages} · {total} curse
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={buildQuery(driverId, search, page - 1)}
                    className="text-emerald-400 hover:underline"
                  >
                    ← Anterior
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={buildQuery(driverId, search, page + 1)}
                    className="text-emerald-400 hover:underline"
                  >
                    Următor →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">{total} curse</p>
          )}
        </>
      )}
    </section>
  );
}
