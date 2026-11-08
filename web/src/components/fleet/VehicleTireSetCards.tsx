"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import {
  tireMountedAsHint,
  tireMountedAsLabel,
  tireSetLocationLabel,
  vehicleTireSeasonLabel,
  type TireMountedAs,
  type TireSetSummary,
  type VehicleTireSeason,
} from "@/lib/vehicle-wheels-types";

type HotelSupplier = { id: string; legalName: string };

type Props = {
  vehicleId: string;
  write: boolean;
  /** Șofer / viewer: doar citire + link inventar. */
  driverPortal?: boolean;
  /** Deep-link din Hub: ?tab=wheels&setId=… */
  initialSetId?: string | null;
  sets: TireSetSummary[];
  onSetsChange: (sets: TireSetSummary[]) => void;
  onInfo: (msg: string | null) => void;
  onError: (msg: string | null) => void;
};

function setTitle(s: TireSetSummary): string {
  const brand = [s.dominantBrand, s.dominantModel].filter(Boolean).join(" ");
  if (s.name?.trim() && s.name.trim().toLowerCase() !== "montat") {
    return brand ? `${s.name.trim()} · ${brand}` : s.name.trim();
  }
  if (s.isMounted) return brand ? `Montat · ${brand}` : "Montat";
  return brand || vehicleTireSeasonLabel(s.season);
}

export function VehicleTireSetCards({
  vehicleId,
  write,
  driverPortal = false,
  initialSetId = null,
  sets,
  onSetsChange,
  onInfo,
  onError,
}: Props) {
  const canMutate = write && !driverPortal;
  const deepLinkConsumed = useRef(false);
  const [openId, setOpenId] = useState<string | null>(() => {
    const sid = initialSetId?.trim();
    if (!sid) return null;
    if (sets.some((s) => s.id === sid)) {
      deepLinkConsumed.current = true;
      return sid;
    }
    return null;
  });

  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const sid = initialSetId?.trim();
    if (!sid) return;
    if (!sets.some((s) => s.id === sid)) return;
    deepLinkConsumed.current = true;
    setOpenId(sid);
  }, [initialSetId, sets]);
  const [pending, setPending] = useState<string | null>(null);
  const [hotelSuppliers, setHotelSuppliers] = useState<HotelSupplier[]>([]);
  const [hotelSupplierId, setHotelSupplierId] = useState("");
  const [hotelBay, setHotelBay] = useState("A1");
  const [hotelSuppliersNote, setHotelSuppliersNote] = useState<string | null>(null);

  const open = useMemo(() => sets.find((s) => s.id === openId) ?? null, [sets, openId]);
  const canSwap = sets.length === 2;

  useEffect(() => {
    if (
      !open ||
      !canMutate ||
      open.isMounted ||
      open.location !== "at_client" ||
      (open.itemCount ?? 0) < 1
    ) {
      setHotelSuppliers([]);
      setHotelSupplierId("");
      setHotelSuppliersNote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${fleetBrowserBase}/vehicles/${vehicleId}/tire-hotel-suppliers`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!res.ok) {
          setHotelSuppliers([]);
          setHotelSupplierId("");
          setHotelSuppliersNote("Nu am putut încărca furnizorii de hotel. Poți deschide un tichet.");
          return;
        }
        const data = (await res.json()) as { items?: HotelSupplier[] };
        if (cancelled) return;
        const items = data.items ?? [];
        setHotelSuppliers(items);
        setHotelSupplierId((prev) => {
          if (items.some((h) => h.id === prev)) return prev;
          return items[0]?.id ?? "";
        });
        setHotelSuppliersNote(
          items.length === 0
            ? "Niciun furnizor hotel pe acest client — folosește solicitarea prin tichet."
            : null,
        );
      } catch {
        if (cancelled) return;
        setHotelSuppliers([]);
        setHotelSupplierId("");
        setHotelSuppliersNote("Nu am putut încărca furnizorii de hotel. Poți deschide un tichet.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open?.id, open?.location, open?.itemCount, open?.isMounted, canMutate, vehicleId]);

  async function patchSeason(setId: string, season: VehicleTireSeason) {
    if (!canMutate) return;
    setPending(`season-${setId}`);
    onError(null);
    onInfo(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/tires/sets/${encodeURIComponent(setId)}/season`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ season, propagateToAssets: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const row = (await res.json()) as TireSetSummary;
      onSetsChange(sets.map((s) => (s.id === setId ? { ...s, ...row } : s)));
      onInfo(`Set → ${vehicleTireSeasonLabel(season)} (anvelope sincronizate).`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Actualizare sezon eșuată");
    } finally {
      setPending(null);
    }
  }

  async function scrap(setId: string) {
    if (!canMutate) return;
    const set = sets.find((s) => s.id === setId);
    if (!set || set.isMounted) return;
    if (set.location === "at_supplier_hotel" || set.hotel?.atSupplierHotel) return;
    if (!window.confirm(`Casezi setul «${setTitle(set)}»?`)) return;
    setPending(`scrap-${setId}`);
    onError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/tires/sets/${encodeURIComponent(setId)}/scrap`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: "{}",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      onSetsChange(sets.filter((s) => s.id !== setId));
      if (openId === setId) setOpenId(null);
      onInfo("Set casat.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Casare eșuată");
    } finally {
      setPending(null);
    }
  }

  async function swapSeasons() {
    if (!canMutate || !canSwap) return;
    const [a, b] = sets;
    if (!a || !b) return;
    const summerWinterPair =
      (a.season === "summer" && b.season === "winter") ||
      (a.season === "winter" && b.season === "summer");
    const sameSummerOrWinter =
      a.season === b.season && (a.season === "summer" || a.season === "winter");
    if (!summerWinterPair && !sameSummerOrWinter) {
      onError(
        "Inversează sezoanele suportă doar Vară↔Iarnă. Editează sezonul pe fișa setului dacă e all-season / necunoscut.",
      );
      return;
    }
    let winterSetId: string | undefined;
    if (sameSummerOrWinter) {
      const pick = window.prompt(
        `Ambele seturi sunt ${vehicleTireSeasonLabel(a.season)}.\nTastează 1 pentru «${setTitle(a)}» ca iarnă, sau 2 pentru «${setTitle(b)}»:`,
        "1",
      );
      if (pick !== "1" && pick !== "2") return;
      winterSetId = pick === "1" ? a.id : b.id;
    } else if (
      !window.confirm(
        `Inversezi sezoanele?\n• ${setTitle(a)}: ${vehicleTireSeasonLabel(a.season)}\n• ${setTitle(b)}: ${vehicleTireSeasonLabel(b.season)}`,
      )
    ) {
      return;
    }
    setPending("swap");
    onError(null);
    try {
      const res = await fetch(
        `${fleetBrowserBase}/vehicles/${vehicleId}/tire-sets/swap-seasons`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify(winterSetId ? { winterSetId } : {}),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      onSetsChange((await res.json()) as TireSetSummary[]);
      onInfo("Sezoanele celor 2 seturi au fost inversate.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Inversare eșuată");
    } finally {
      setPending(null);
    }
  }

  async function hotelCheckIn(setId: string) {
    if (!canMutate || !hotelSupplierId || !hotelBay.trim()) return;
    if (!hotelSuppliers.some((h) => h.id === hotelSupplierId)) {
      onError("Selectează un furnizor hotel valid din listă.");
      return;
    }
    const set = sets.find((s) => s.id === setId);
    if (
      !set ||
      set.isMounted ||
      set.location === "at_supplier_hotel" ||
      set.hotel?.atSupplierHotel ||
      set.location !== "at_client" ||
      (set.itemCount ?? 0) < 1
    ) {
      return;
    }
    if (!window.confirm("Confirmi check-in hotel pentru acest set?")) return;
    setPending(`hotel-${setId}`);
    onError(null);
    try {
      const res = await fetch(
        `${fleetBrowserBase}/tires/sets/${encodeURIComponent(setId)}/hotel-check-in`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            supplierId: hotelSupplierId,
            bayCode: hotelBay.trim(),
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      onSetsChange((await res.json()) as TireSetSummary[]);
      onInfo("Setul a fost check-in la hotel.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Check-in hotel eșuat");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {sets.length} set{sets.length === 1 ? "" : "uri"} alocate pe acest vehicul — același
          inventar ca în Hub anvelope.
        </p>
        {canMutate && canSwap ? (
          <button
            type="button"
            disabled={pending === "swap"}
            onClick={() => void swapSeasons()}
            className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-950/50 disabled:opacity-50"
          >
            Inversează sezoanele
          </button>
        ) : null}
      </div>

      {sets.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-xs text-zinc-500">
          Niciun set. Adaugă un set de schimb sau salvează pozițiile montate (devin set «Montat»).
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sets.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{setTitle(s)}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {vehicleTireSeasonLabel(s.season)}
                    {s.dominantSize ? ` · ${s.dominantSize}` : ""}
                    {` · ${s.itemCount} buc`}
                    {" · "}
                    {tireMountedAsLabel(s.mountedAs)}
                  </p>
                </div>
                <span
                  className={
                    s.isMounted || s.location === "on_vehicle"
                      ? "shrink-0 rounded bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-200"
                      : s.hotel?.atSupplierHotel || s.location === "at_supplier_hotel"
                        ? "shrink-0 rounded bg-violet-900/50 px-2 py-0.5 text-[10px] text-violet-200"
                        : "shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                  }
                >
                  {tireSetLocationLabel(
                    s.location ??
                      (s.isMounted
                        ? "on_vehicle"
                        : s.hotel?.atSupplierHotel
                          ? "at_supplier_hotel"
                          : "other"),
                  )}
                </span>
              </div>

              {s.hotel?.atSupplierHotel ? (
                <p className="text-[11px] text-violet-200/90">
                  {[
                    s.hotel.supplierName,
                    s.hotel.locationCode ? `raft ${s.hotel.locationCode}` : null,
                    s.hotel.checkInAt
                      ? `din ${new Date(s.hotel.checkInAt).toLocaleDateString("ro-RO")}`
                      : null,
                    (s.photoCount ?? 0) > 0 ? `${s.photoCount} poze` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}

              {s.seasonMismatch ? (
                <p className="rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-100">
                  Sezon set ≠ anvelope ({vehicleTireSeasonLabel(s.itemsSeason ?? "unknown")})
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpenId(s.id)}
                  className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-900"
                >
                  Deschide fișa
                </button>
                <Link
                  href={
                    s.hrefInventar ??
                    `/fleet/tires?tab=inventar&vehicleId=${encodeURIComponent(vehicleId)}&setId=${encodeURIComponent(s.id)}`
                  }
                  className="rounded border border-violet-800/60 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-950/40"
                >
                  Inventar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal>
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Închide"
            onClick={() => setOpenId(null)}
          />
          <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Fișă set anvelope</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-100">{setTitle(open)}</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {tireSetLocationLabel(open.location)} · {tireMountedAsLabel(open.mountedAs)}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {tireMountedAsHint(open.mountedAs as TireMountedAs)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Închide
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px]">
              <div>
                <dt className="text-zinc-500">Ce</dt>
                <dd className="text-zinc-200">
                  {vehicleTireSeasonLabel(open.season)}
                  {open.dominantBrand ? ` · ${open.dominantBrand}` : ""}
                  {open.dominantSize ? ` · ${open.dominantSize}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Unde</dt>
                <dd className="text-zinc-200">{tireSetLocationLabel(open.location)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cum</dt>
                <dd className="text-zinc-200">{tireMountedAsLabel(open.mountedAs)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cine / când</dt>
                <dd className="text-zinc-200">
                  {open.hotel?.atSupplierHotel
                    ? [
                        open.hotel.supplierName ?? "Hotel",
                        open.hotel.checkInAt
                          ? `din ${new Date(open.hotel.checkInAt).toLocaleDateString("ro-RO")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : open.isMounted
                      ? "Montat pe vehicul"
                      : "Depozit / fără hotel"}
                </dd>
              </div>
            </dl>

            <section className="mt-5 space-y-3 text-sm">
              {open.seasonMismatch ? (
                <p className="rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1.5 text-[11px] text-amber-100">
                  De ce avertizare: sezonul setului (
                  {vehicleTireSeasonLabel(open.season)}) ≠ sezonul anvelopelor din set (
                  {vehicleTireSeasonLabel(open.itemsSeason ?? "unknown")}). Aliniază din tab sau
                  schimbă sezonul aici (propagă pe anvelope).
                </p>
              ) : null}
              <label className="block text-xs text-zinc-500">
                Sezon set
                {canMutate ? (
                  <select
                    value={open.season}
                    disabled={pending === `season-${open.id}`}
                    onChange={(e) => void patchSeason(open.id, e.target.value as VehicleTireSeason)}
                    className={`${OPS_INPUT_CLASS} mt-1`}
                  >
                    {open.season === "unknown" ? (
                      <option value="unknown">Necunoscut</option>
                    ) : null}
                    <option value="summer">Vară</option>
                    <option value="winter">Iarnă</option>
                    <option value="all_season">All-season</option>
                  </select>
                ) : (
                  <p className="mt-1 text-zinc-200">{vehicleTireSeasonLabel(open.season)}</p>
                )}
              </label>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-zinc-500">Brand</dt>
                  <dd className="text-zinc-200">{open.dominantBrand ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Model</dt>
                  <dd className="text-zinc-200">{open.dominantModel ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Dimensiune</dt>
                  <dd className="text-zinc-200">{open.dominantSize ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Bucăți</dt>
                  <dd className="text-zinc-200">{open.itemCount}</dd>
                </div>
              </dl>

              {open.hotel?.atSupplierHotel ? (
                <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2 text-xs text-violet-100">
                  Hotel: {open.hotel.supplierName ?? "—"}
                  {open.hotel.locationCode ? ` · raft ${open.hotel.locationCode}` : ""}
                  {open.hotel.checkInAt
                    ? ` · din ${new Date(open.hotel.checkInAt).toLocaleDateString("ro-RO")}`
                    : ""}
                </div>
              ) : null}

              <div>
                <p className="text-xs font-medium text-zinc-400">Anvelope în set</p>
                <ul className="mt-2 space-y-1.5">
                  {(open.items ?? []).map((it) => (
                    <li
                      key={it.assetId}
                      className="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-[11px] text-zinc-300"
                    >
                      {[it.position?.toUpperCase(), it.brand, it.model, it.size]
                        .filter(Boolean)
                        .join(" · ") || it.assetId}
                      {it.treadMm != null ? ` · ${it.treadMm} mm` : ""}
                      {it.dot ? ` · DOT ${it.dot}` : ""}
                    </li>
                  ))}
                  {(open.items ?? []).length === 0 ? (
                    <li className="text-[11px] text-zinc-500">Fără anvelope în set.</li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-400">
                  Poze {(open.photoCount ?? open.photoUrls?.length ?? 0) > 0
                    ? `(${open.photoCount ?? open.photoUrls?.length})`
                    : ""}
                </p>
                {(open.photoUrls?.length ?? 0) > 0 ? (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {open.photoUrls!.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded border border-zinc-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-20 w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Pozele de recepție apar după check-in hotel (intake).
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                <Link
                  href={
                    open.hrefInventar ??
                    `/fleet/tires?tab=inventar&vehicleId=${encodeURIComponent(vehicleId)}&setId=${encodeURIComponent(open.id)}`
                  }
                  className="rounded-lg border border-violet-700/50 bg-violet-950/30 px-3 py-2 text-center text-xs text-violet-100 hover:bg-violet-950/50"
                >
                  Deschide în inventar Hub
                </Link>
                {canMutate && !open.isMounted ? (
                  <Link
                    href={
                      open.hrefSeasonTicket ??
                      `/fleet/tickets/new?vehicleId=${encodeURIComponent(vehicleId)}`
                    }
                    className="rounded-lg border border-emerald-800/50 px-3 py-2 text-center text-xs text-emerald-100 hover:bg-emerald-950/30"
                  >
                    Tichet sezon / operațiuni
                  </Link>
                ) : null}

                {canMutate &&
                !open.isMounted &&
                open.location !== "at_supplier_hotel" &&
                !open.hotel?.atSupplierHotel ? (
                  <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <p className="text-[11px] text-zinc-400">
                      {open.location === "at_client" && (open.itemCount ?? 0) > 0
                        ? "Setul e în depozit — poți face check-in hotel aici sau deschide o solicitare."
                        : "Solicitare hotel (tichet) — check-in direct doar pentru seturi în depozit client cu anvelope."}
                    </p>
                    {hotelSuppliersNote ? (
                      <p className="text-[11px] text-amber-200/90">{hotelSuppliersNote}</p>
                    ) : null}
                    {open.location === "at_client" &&
                    (open.itemCount ?? 0) > 0 &&
                    hotelSuppliers.length > 0 ? (
                      <>
                        <select
                          value={hotelSupplierId}
                          onChange={(e) => setHotelSupplierId(e.target.value)}
                          className={OPS_INPUT_CLASS}
                        >
                          {hotelSuppliers.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.legalName}
                            </option>
                          ))}
                        </select>
                        <input
                          value={hotelBay}
                          onChange={(e) => setHotelBay(e.target.value)}
                          placeholder="Raft / bay (ex. A1)"
                          className={OPS_INPUT_CLASS}
                        />
                        <button
                          type="button"
                          disabled={pending === `hotel-${open.id}` || !hotelSupplierId}
                          onClick={() => void hotelCheckIn(open.id)}
                          className="w-full rounded-lg border border-violet-700/50 bg-violet-950/40 px-3 py-2 text-xs text-violet-100 disabled:opacity-50"
                        >
                          Check-in hotel
                        </button>
                      </>
                    ) : null}
                    <Link
                      href={
                        open.hrefHotelTicket ??
                        `/fleet/tickets/new?vehicleId=${encodeURIComponent(vehicleId)}&subject=${encodeURIComponent("Hotel anvelope")}`
                      }
                      className="block w-full rounded-lg border border-zinc-700 px-3 py-2 text-center text-xs text-zinc-200 hover:bg-zinc-900"
                    >
                      Solicitare hotel (tichet)
                    </Link>
                  </div>
                ) : null}

                {canMutate &&
                !open.isMounted &&
                open.location !== "at_supplier_hotel" &&
                !open.hotel?.atSupplierHotel ? (
                  <button
                    type="button"
                    disabled={pending === `scrap-${open.id}`}
                    onClick={() => void scrap(open.id)}
                    className="rounded-lg border border-red-900/50 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Casare set
                  </button>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
