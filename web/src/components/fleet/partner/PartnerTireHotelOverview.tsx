"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type OverviewStay = {
  id: string;
  plate?: string | null;
  setName?: string | null;
  season?: string | null;
  locationCode?: string | null;
  checkInAt?: string;
  feeCents?: number | null;
  supplierId?: string;
  supplierName?: string | null;
};

export function PartnerTireHotelOverview() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<OverviewStay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = new URLSearchParams();
    const suppliers = searchParams.get("suppliers");
    const supplierId = searchParams.get("supplierId");
    if (suppliers) p.set("suppliers", suppliers);
    if (supplierId) p.set("supplierId", supplierId);
    p.set("overview", "1");
    p.set("status", "active");
    p.set("take", "200");
    setLoading(true);
    void fetch(`/api/partner/tire-hotel/stays?${p.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Nu am putut încărca overview-ul hotel");
        const data = (await res.json()) as { items?: OverviewStay[] };
        setItems(data.items ?? []);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) return <p className="text-xs text-zinc-500">Se încarcă overview…</p>;
  if (error) {
    return (
      <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Overview read-only pe toți partenerii din scope. Pentru check-in / eliberare selectează un
        singur furnizor.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Niciun sejur activ.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/80 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Partener</th>
                <th className="px-3 py-2">Placă</th>
                <th className="px-3 py-2">Set</th>
                <th className="px-3 py-2">Raft</th>
                <th className="px-3 py-2">Check-in</th>
                <th className="px-3 py-2">Tarif</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800/80">
                  <td className="px-3 py-2 text-zinc-200">{s.supplierName ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{s.plate ?? "—"}</td>
                  <td className="px-3 py-2">{s.setName ?? s.season ?? "—"}</td>
                  <td className="px-3 py-2">{s.locationCode ?? "—"}</td>
                  <td className="px-3 py-2">
                    {s.checkInAt
                      ? new Date(s.checkInAt).toLocaleDateString("ro-RO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {s.feeCents != null
                      ? `${(s.feeCents / 100).toLocaleString("ro-RO")} lei`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {s.supplierId ? (
                      <Link
                        href={`/fleet/partner/tire-hotel?supplierId=${encodeURIComponent(s.supplierId)}`}
                        className="text-violet-300 hover:underline"
                      >
                        Deschide
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
