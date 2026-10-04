"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VehiclesDataGrid } from "@/components/fleet/VehiclesDataGrid";
import { VEHICLE_STATUSES, fleetBrowserBase, type VehicleListPayload, type VehicleRecord } from "@/lib/fleet-api";

type Props = {
  clientCode: string;
  canWrite: boolean;
};

export function ClientVehiclesPanel({ clientCode, canWrite }: Props) {
  const [items, setItems] = useState<VehicleRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      clientId: clientCode,
      page: "1",
      pageSize: "200",
    });
    void (async () => {
      try {
        const res = await fetch(`${fleetBrowserBase}/vehicles?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as VehicleListPayload;
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? data.items?.length ?? 0);
        setFailed(false);
      } catch {
        if (!cancelled) {
          setItems([]);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((v) => {
      if (status && v.status !== status) return false;
      if (!needle) return true;
      const blob = [v.registrationNumber, v.brand, v.model, v.vin, v.assignedDriverName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [items, q, status]);

  const listHref = `/fleet/vehicles?clientId=${encodeURIComponent(clientCode)}`;

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Căutare</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nr. înmatriculare, VIN, șofer…"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          />
        </div>
        <div className="flex min-w-[10rem] flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          >
            <option value="">Toate</option>
            {VEHICLE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setStatus("");
          }}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        >
          Resetează
        </button>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {canWrite ? (
            <Link
              href="/fleet/vehicles/new"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
            >
              Vehicul nou
            </Link>
          ) : null}
          <Link
            href={listHref}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Lista completă
          </Link>
        </div>
      </form>

      {items === null ? (
        <p className="text-sm text-zinc-500">Se încarcă vehiculele…</p>
      ) : failed ? (
        <p className="text-amber-400">Nu am putut încărca vehiculele. Verifică API-ul și sesiunea.</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-400">
          Nu există vehicule pentru filtrele curente.
          {canWrite ? (
            <>
              {" "}
              <Link href="/fleet/vehicles/new" className="text-emerald-400 underline hover:text-emerald-300">
                Adaugă vehicul
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : (
        <>
          <VehiclesDataGrid vehicles={filtered} canWrite={canWrite} />
          <p className="text-sm text-zinc-400">
            {filtered.length} din {total} vehicule
            {total > items.length ? (
              <>
                {" "}
                · în fișă sunt primele {items.length}.{" "}
                <Link href={listHref} className="text-emerald-400 hover:underline">
                  Deschide lista cu paginare
                </Link>
              </>
            ) : null}
          </p>
        </>
      )}
    </div>
  );
}
