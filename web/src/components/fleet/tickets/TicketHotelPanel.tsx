"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import type { TicketGestiuneOp } from "@/lib/tickets-api";
import {
  tireSetLocationLabel,
  vehicleTireSeasonLabel,
  type TireSetSummary,
  type VehicleWheelsPayload,
} from "@/lib/vehicle-wheels-types";

type HotelSupplier = { id: string; legalName: string };

type Props = {
  ticketId: string;
  vehicleId: string;
  canWrite: boolean;
  plate?: string | null;
  gestiuneOp?: TicketGestiuneOp | null;
  assignedSupplierId?: string | null;
};

function setTitle(s: TireSetSummary): string {
  const brand = [s.dominantBrand, s.dominantModel].filter(Boolean).join(" ");
  if (s.name?.trim()) return brand ? `${s.name.trim()} · ${brand}` : s.name.trim();
  if (s.isMounted) return brand ? `Montat · ${brand}` : "Montat";
  return brand || vehicleTireSeasonLabel(s.season);
}

function pickDefaultSet(
  rows: TireSetSummary[],
  op: TicketGestiuneOp | null | undefined,
): string {
  if (op === "eliberare" || op === "transfer" || op === "casare") {
    const atHotel = rows.find((r) => r.hotel?.atSupplierHotel);
    if (atHotel) return atHotel.id;
  }
  const store = rows.find(
    (r) => !r.isMounted && r.location === "at_client" && (r.itemCount ?? 0) > 0,
  );
  return store?.id ?? rows.find((r) => !r.isMounted)?.id ?? rows[0]?.id ?? "";
}

function opCopy(op: TicketGestiuneOp | null | undefined): {
  title: string;
  what: string;
  hint: string;
} {
  if (op === "eliberare") {
    return {
      title: "Flux eliberare hotel",
      what: "Ce e de făcut: alege setul de pe hotel → execută eliberarea (PV check-out). Nu e check-in.",
      hint: "Setul iese din inventarul hotel. Montaj pe mașină = flux service / WO separat, dacă e nevoie.",
    };
  }
  if (op === "transfer") {
    return {
      title: "Flux transfer hotel",
      what: "Ce e de făcut: alege setul de pe hotel → transferă la alt partener (PV transfer).",
      hint: "Nu e check-in și nu e predare la client.",
    };
  }
  if (op === "casare") {
    return {
      title: "Flux casare hotel",
      what: "Ce e de făcut: alege setul de pe hotel → casare (PV casare).",
      hint: "Casarea scoate setul din inventar.",
    };
  }
  return {
    title: "Flux cazare hotel",
    what: "Ce e de făcut: alege setul de depozitat → check-in la hotel (sau deschide fișa pe Roți).",
    hint: "Nu e flux de atelier. Montaj/demontaj = comandă anvelope (WO), separat.",
  };
}

/**
 * Flux hotel pe tichet tire_storage — custody pe set, fără atelier ca drum principal.
 * Textul și acțiunile depind de gestiuneOp (cazare vs eliberare vs transfer vs casare).
 */
export function TicketHotelPanel({
  ticketId,
  vehicleId,
  canWrite,
  plate,
  gestiuneOp = null,
  assignedSupplierId = null,
}: Props) {
  const [sets, setSets] = useState<TireSetSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [suppliers, setSuppliers] = useState<HotelSupplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [bay, setBay] = useState("A1");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const copy = opCopy(gestiuneOp);
  const isCazare = !gestiuneOp || gestiuneOp === "cazare";
  const isEliberare = gestiuneOp === "eliberare";
  const isTransfer = gestiuneOp === "transfer";
  const isCasare = gestiuneOp === "casare";

  const loadSets = useCallback(async () => {
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/wheels`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as VehicleWheelsPayload;
      const rows = payload.sets ?? [];
      setSets(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return pickDefaultSet(rows, gestiuneOp);
      });
    } catch {
      /* ignore */
    }
  }, [vehicleId, gestiuneOp]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  useEffect(() => {
    if (!canWrite || !isCazare) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${fleetBrowserBase}/vehicles/${vehicleId}/tire-hotel-suppliers`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: HotelSupplier[] };
        const items = data.items ?? [];
        if (cancelled) return;
        setSuppliers(items);
        setSupplierId((prev) => (items.some((h) => h.id === prev) ? prev : items[0]?.id ?? ""));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, canWrite, isCazare]);

  const selected = sets.find((s) => s.id === selectedId) ?? null;
  const canCheckIn =
    isCazare &&
    canWrite &&
    selected &&
    !selected.isMounted &&
    selected.location === "at_client" &&
    (selected.itemCount ?? 0) > 0 &&
    !selected.hotel?.atSupplierHotel;

  async function hotelCheckIn() {
    if (!canCheckIn || !selected || !supplierId || !bay.trim()) return;
    if (!window.confirm(`Check-in hotel pentru «${setTitle(selected)}»?`)) return;
    setPending("hotel");
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(
        `${fleetBrowserBase}/tires/sets/${encodeURIComponent(selected.id)}/hotel-check-in`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            supplierId,
            bayCode: bay.trim(),
            sourceSystem: "ticket_hotel_panel",
            ticketId,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setSets((await res.json()) as TireSetSummary[]);
      setInfo(
        "Setul a fost cazat la hotel. Tichetul trece în «În lucru». Deschide Acțiuni → Rezolvă când e gata.",
      );
      window.dispatchEvent(new CustomEvent("fleet-ticket-tab", { detail: "actions" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in hotel eșuat");
    } finally {
      setPending(null);
    }
  }

  const wheelsHref = `/fleet/vehicles/${vehicleId}/edit?tab=wheels${
    selectedId ? `&setId=${encodeURIComponent(selectedId)}` : ""
  }`;
  const inventarHref = `/fleet/tires?tab=inventar&vehicleId=${encodeURIComponent(vehicleId)}${
    selectedId ? `&setId=${encodeURIComponent(selectedId)}` : ""
  }`;
  const partnerEliberareQs = new URLSearchParams();
  if (assignedSupplierId) partnerEliberareQs.set("supplierId", assignedSupplierId);
  const partnerEliberareHref = `/fleet/partner/tire-requests/${encodeURIComponent(ticketId)}/eliberare${
    partnerEliberareQs.toString() ? `?${partnerEliberareQs}` : ""
  }`;
  const partnerInventarQs = new URLSearchParams();
  if (assignedSupplierId) partnerInventarQs.set("supplierId", assignedSupplierId);
  const partnerInventarHref = `/fleet/partner/tire-hotel${
    partnerInventarQs.toString() ? `?${partnerInventarQs}` : ""
  }`;

  return (
    <div className="space-y-3 rounded-xl border border-violet-900/40 bg-violet-950/20 p-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-violet-300/80">
          {copy.title}
        </p>
        <p className="mt-1 text-sm text-zinc-200">
          {copy.what}
          {plate ? ` Vehicul ${plate}.` : ""}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">{copy.hint}</p>
      </div>

      {sets.length === 0 ? (
        <p className="text-xs text-amber-200/90">
          Niciun set pe vehicul. Adaugă seturi din{" "}
          <Link href={wheelsHref} className="underline underline-offset-2">
            Roți
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  selectedId === s.id
                    ? "border-violet-600/60 bg-violet-950/40 text-violet-100"
                    : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span className="block font-medium">{setTitle(s)}</span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">
                  {vehicleTireSeasonLabel(s.season)} · {s.itemCount} buc ·{" "}
                  {tireSetLocationLabel(s.location)}
                  {s.hotel?.atSupplierHotel && s.hotel.supplierName
                    ? ` · ${s.hotel.supplierName}`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {info ? <p className="text-xs text-emerald-400/90">{info}</p> : null}

      {isCazare && canCheckIn ? (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-[11px] text-zinc-400">Check-in hotel pentru setul selectat</p>
          {suppliers.length > 0 ? (
            <>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={OPS_INPUT_CLASS}
              >
                {suppliers.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.legalName}
                  </option>
                ))}
              </select>
              <input
                value={bay}
                onChange={(e) => setBay(e.target.value)}
                placeholder="Raft / bay"
                className={OPS_INPUT_CLASS}
              />
              <button
                type="button"
                disabled={pending === "hotel" || !supplierId}
                onClick={() => void hotelCheckIn()}
                className="w-full rounded-lg border border-violet-700/50 bg-violet-950/50 px-3 py-2 text-xs text-violet-100 disabled:opacity-50"
              >
                {pending === "hotel" ? "Se procesează…" : "Check-in hotel"}
              </button>
            </>
          ) : (
            <p className="text-[11px] text-amber-200/80">
              Niciun furnizor hotel pe client — configurează alocarea sau folosește fișa setului.
            </p>
          )}
        </div>
      ) : null}

      {isCazare && selected?.hotel?.atSupplierHotel ? (
        <div className="space-y-2">
          <p className="text-xs text-violet-200/90">
            Setul e deja la hotel
            {selected.hotel.supplierName ? ` (${selected.hotel.supplierName})` : ""}
            {selected.hotel.stayId ? ` · stay ${selected.hotel.stayId.slice(0, 8)}…` : ""}.
          </p>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("fleet-ticket-tab", { detail: "actions" }))
            }
            className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-950/50"
          >
            Deschide Acțiuni → Rezolvă tichetul
          </button>
        </div>
      ) : null}

      {isCazare && selected?.isMounted ? (
        <p className="text-xs text-amber-200/90">
          Setul e montat pe mașină — demontează întâi (WO anvelope) sau alege setul din depozit.
        </p>
      ) : null}

      {(isEliberare || isTransfer || isCasare) && selected?.hotel?.atSupplierHotel ? (
        <div className="space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
          <p className="text-xs text-emerald-100/90">
            Setul e la hotel
            {selected.hotel.supplierName ? ` (${selected.hotel.supplierName})` : ""}. Continuă
            execuția pe inventarul partenerului
            {isEliberare
              ? " (PV check-out → iese din inventar)"
              : isTransfer
                ? " (PV transfer)"
                : " (PV casare)"}
            .
          </p>
          <div className="flex flex-wrap gap-2">
            {isEliberare ? (
              <Link
                href={partnerEliberareHref}
                className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-950/60"
              >
                Execută eliberarea
              </Link>
            ) : null}
            <Link
              href={partnerInventarHref}
              className="rounded-lg border border-violet-800/50 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/40"
            >
              Inventar hotel partener
            </Link>
          </div>
        </div>
      ) : null}

      {(isEliberare || isTransfer || isCasare) &&
      selected &&
      !selected.hotel?.atSupplierHotel ? (
        <p className="text-xs text-amber-200/90">
          {selected.isMounted
            ? "Setul selectat e montat pe mașină — pentru eliberare alege setul «La hotel»."
            : "Setul selectat nu e la hotel. Alege setul aflat în custodie hotel."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={wheelsHref}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Fișă set pe Roți
        </Link>
        <Link
          href={inventarHref}
          className="rounded-lg border border-violet-800/50 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/40"
        >
          Inventar Hub
        </Link>
      </div>
    </div>
  );
}
