"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parsePartnerSupplierQuery } from "@/lib/partner-context";
import type {
  TireHotelCapability,
  TireHotelSearchVehicle,
  TireHotelStay,
} from "@/lib/partner-tire-hotel-api";
import {
  INTAKE_PHOTO_MAX_COUNT,
  mergeIntakePhotoUrls,
  normalizeIntakePhotoUrls,
  parseIntakePhotoUrlsInput,
  formatTireSetSearchFieldOnChange,
  parseTireSetSearchInput,
  readIntakePhotoFilesAsDataUrls,
} from "@/lib/tire-set-search";
import { vehicleTireSeasonLabel } from "@/lib/vehicle-wheels-types";
import { TireHotelIntakePhotos } from "@/components/fleet/partner/TireHotelIntakePhotos";
import { TireHotelQrPayload } from "@/components/fleet/partner/TireHotelQrPayload";
import { TireHotelReceiptPanel } from "@/components/fleet/partner/TireHotelReceiptPanel";

type Props = {
  canWrite: boolean;
  supplierId?: string;
};

function formatCheckIn(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function PartnerTireHotelClient({ canWrite, supplierId }: Props) {
  const searchParams = useSearchParams();
  const supplierQ = useMemo(
    () => parsePartnerSupplierQuery(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    const sid = supplierId ?? supplierQ.supplierId;
    if (sid) p.set("supplierId", sid);
    return p.toString();
  }, [supplierId, supplierQ.supplierId]);

  const [capability, setCapability] = useState<TireHotelCapability | null>(null);
  const [stays, setStays] = useState<TireHotelStay[]>([]);
  const [filterPlate, setFilterPlate] = useState("");
  const [searchPlate, setSearchPlate] = useState("");
  const [searchHits, setSearchHits] = useState<TireHotelSearchVehicle[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [locationCode, setLocationCode] = useState("");
  const [intakePhotoUrlsInput, setIntakePhotoUrlsInput] = useState("");
  const [intakePhotoFileUrls, setIntakePhotoFileUrls] = useState<string[]>([]);
  const [intakePhotoPreviewUrls, setIntakePhotoPreviewUrls] = useState<string[]>([]);
  const [intakeTreadNotes, setIntakeTreadNotes] = useState("");
  const [receiptStay, setReceiptStay] = useState<TireHotelStay | null>(null);
  const [expandedReceiptStayId, setExpandedReceiptStayId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supplierName = capability?.supplierName ?? null;

  const loadStays = useCallback(async () => {
    const fp = filterPlate.trim();
    const url = `/api/partner/tire-hotel/stays?${qs}${fp ? `&plate=${encodeURIComponent(fp)}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Nu am putut încărca sejururile");
    const data = (await res.json()) as { items?: TireHotelStay[] };
    setStays(
      (data.items ?? []).map((s) => ({
        ...s,
        intakePhotos: normalizeIntakePhotoUrls(s.intakePhotos),
      })),
    );
  }, [filterPlate, qs]);

  const loadCapability = useCallback(async () => {
    const res = await fetch(`/api/partner/tire-hotel/capability?${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    setCapability((await res.json()) as TireHotelCapability);
  }, [qs]);

  useEffect(() => {
    void loadCapability();
  }, [loadCapability]);

  useEffect(() => {
    if (!capability?.hasTireStorage) return;
    void loadStays().catch((e: Error) => setError(e.message));
  }, [capability?.hasTireStorage, loadStays]);

  async function runSearch() {
    setError(null);
    const raw = searchPlate.trim();
    const parsed = parseTireSetSearchInput(raw);
    if (parsed.kind === "plate" && parsed.plate.length < 2) {
      setError("Introdu minim 2 caractere din număr sau lipește codul FE:tire-set:…");
      return;
    }
    if (parsed.kind === "setId" && !parsed.setId) {
      setError("Cod set invalid");
      return;
    }
    setBusy("search");
    try {
      const res = await fetch(
        `/api/partner/tire-hotel/search?${qs}&plate=${encodeURIComponent(raw)}`,
      );
      if (!res.ok) throw new Error("Căutare eșuată");
      const data = (await res.json()) as { vehicles?: TireHotelSearchVehicle[] };
      setSearchHits(data.vehicles ?? []);
      setSelectedSetId(null);
      setSelectedVehicleId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  async function checkIn() {
    if (!selectedSetId || !locationCode.trim()) {
      setError("Alege setul și locația (raft/cod)");
      return;
    }
    const intakePhotos = mergeIntakePhotoUrls(
      parseIntakePhotoUrlsInput(intakePhotoUrlsInput),
      intakePhotoFileUrls,
    );
    setBusy("check-in");
    setError(null);
    try {
      const res = await fetch("/api/partner/tire-hotel/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId ?? supplierQ.supplierId,
          setId: selectedSetId,
          vehicleId: selectedVehicleId ?? undefined,
          locationCode: locationCode.trim(),
          intakePhotos: intakePhotos.length ? intakePhotos : undefined,
          intakeTreadNotes: intakeTreadNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Check-in eșuat");
      }
      const data = (await res.json()) as { stay?: TireHotelStay };
      const stay = data.stay
        ? {
            ...data.stay,
            intakePhotos: normalizeIntakePhotoUrls(data.stay.intakePhotos),
          }
        : null;
      setSearchPlate("");
      setSearchHits([]);
      setSelectedSetId(null);
      setSelectedVehicleId(null);
      setLocationCode("");
      setIntakePhotoUrlsInput("");
      setIntakePhotoFileUrls([]);
      setIntakePhotoPreviewUrls([]);
      setIntakeTreadNotes("");
      await loadStays();
      if (stay) {
        setReceiptStay(stay);
        setExpandedReceiptStayId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  async function checkOut(stayId: string) {
    if (!canWrite) return;
    setBusy(stayId);
    setError(null);
    try {
      const res = await fetch("/api/partner/tire-hotel/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId ?? supplierQ.supplierId,
          stayId,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Eliberare eșuată");
      }
      if (receiptStay?.id === stayId) setReceiptStay(null);
      if (expandedReceiptStayId === stayId) setExpandedReceiptStayId(null);
      await loadStays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  if (capability && !capability.hasTireStorage) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center">
        <p className="text-sm text-zinc-300">Hotel anvelope</p>
        <p className="mt-2 text-xs text-zinc-500">
          Furnizorul nu are activă capacitatea «Depozitare anvelope (hotel)». Contactează administratorul
          flotei pentru a o activa în profilul furnizorului.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-24">
      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {receiptStay ? (
        <TireHotelReceiptPanel
          stay={receiptStay}
          supplierName={supplierName}
          autoFocusPrint
          onClose={() => setReceiptStay(null)}
        />
      ) : null}

      <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="text-base font-medium text-zinc-100">Check-in set</h2>
        <p className="text-xs text-zinc-500">
          Caută după număr, lipește codul <span className="font-mono text-zinc-400">FE:tire-set:…</span>{" "}
          sau ID set.
        </p>
        <div className="flex gap-2">
          <input
            value={searchPlate}
            onChange={(e) => setSearchPlate(formatTireSetSearchFieldOnChange(e.target.value))}
            placeholder="B 123 ABC sau FE:tire-set:…"
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="button"
            disabled={busy === "search" || !canWrite}
            onClick={() => void runSearch()}
            className="shrink-0 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Caută
          </button>
        </div>

        {searchHits.map((v) => (
          <div key={v.id} className="space-y-2 border-t border-zinc-800/80 pt-3">
            <p className="text-sm font-medium text-zinc-200">{v.registrationNumber}</p>
            {v.sets.length === 0 ? (
              <p className="text-xs text-zinc-500">Niciun set pe vehicul.</p>
            ) : (
              v.sets.map((s) => (
                <div key={s.id} className="space-y-2">
                  <button
                    type="button"
                    disabled={!canWrite || s.hasActiveStayHere}
                    onClick={() => {
                      setSelectedSetId(s.id);
                      setSelectedVehicleId(v.id);
                    }}
                    className={`flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                      selectedSetId === s.id
                        ? "border-violet-500 bg-violet-950/40"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                    } disabled:opacity-40`}
                  >
                    <span className="text-sm text-zinc-100">
                      {s.name?.trim() || vehicleTireSeasonLabel(s.season)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {vehicleTireSeasonLabel(s.season)} · {s.itemCount} anvelope
                      {s.hasActiveStayHere ? " · deja la hotel" : ""}
                    </span>
                  </button>
                  <TireHotelQrPayload payload={s.qrPayload} compact />
                </div>
              ))
            )}
          </div>
        ))}

        {selectedSetId ? (
          <div className="space-y-3 border-t border-zinc-800/80 pt-3">
            <input
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value.toUpperCase())}
              placeholder="Cod locație (ex. A-12)"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100"
            />
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500" htmlFor="tire-hotel-intake-photos">
                Foto recepție — max {INTAKE_PHOTO_MAX_COUNT} imagini (~400KB/fișier), URL sau fișiere
                locale
              </label>
              <input
                id="tire-hotel-intake-files"
                type="file"
                accept="image/*"
                multiple
                disabled={!canWrite}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files?.length) return;
                  void (async () => {
                    const { dataUrls, errors } = await readIntakePhotoFilesAsDataUrls(files);
                    if (errors.length) setError(errors.join(" · "));
                    if (!dataUrls.length) return;
                    setIntakePhotoFileUrls((prev) =>
                      mergeIntakePhotoUrls([], [...prev, ...dataUrls]),
                    );
                    setIntakePhotoPreviewUrls((prev) =>
                      mergeIntakePhotoUrls([], [...prev, ...dataUrls]),
                    );
                    e.target.value = "";
                  })();
                }}
              />
              {intakePhotoPreviewUrls.length > 0 ? (
                <TireHotelIntakePhotos urls={intakePhotoPreviewUrls} maxVisible={INTAKE_PHOTO_MAX_COUNT} />
              ) : null}
              <textarea
                id="tire-hotel-intake-photos"
                value={intakePhotoUrlsInput}
                onChange={(e) => setIntakePhotoUrlsInput(e.target.value)}
                rows={3}
                placeholder="https://… (opțional dacă ai încărcat fișiere)"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500" htmlFor="tire-hotel-tread-notes">
                Note profil / stare anvelope la recepție
              </label>
              <textarea
                id="tire-hotel-tread-notes"
                value={intakeTreadNotes}
                onChange={(e) => setIntakeTreadNotes(e.target.value)}
                rows={2}
                placeholder="Ex. FA 4mm, FD 3mm…"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <button
              type="button"
              disabled={!canWrite || busy === "check-in"}
              onClick={() => void checkIn()}
              className="w-full rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white disabled:opacity-50"
            >
              Confirmă check-in
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-medium text-zinc-100">Seturi în hotel</h2>
          <input
            value={filterPlate}
            onChange={(e) => setFilterPlate(formatTireSetSearchFieldOnChange(e.target.value))}
            onBlur={() => void loadStays().catch(() => undefined)}
            placeholder="Filtru nr. / QR"
            className="w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
          />
        </div>
        {stays.length === 0 ? (
          <p className="text-xs text-zinc-500">Niciun set activ în depozit.</p>
        ) : (
          <ul className="space-y-2">
            {stays.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{s.plate}</span>
                  <span className="text-xs text-zinc-500">
                    {s.setName?.trim() || vehicleTireSeasonLabel(s.season)}
                  </span>
                  {s.locationCode ? (
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {s.locationCode}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-500">Check-in {formatCheckIn(s.checkInAt)}</p>
                <TireHotelQrPayload payload={s.qrPayload} />
                {s.intakeTreadNotes?.trim() ? (
                  <p className="whitespace-pre-wrap text-xs text-zinc-400">{s.intakeTreadNotes.trim()}</p>
                ) : null}
                <TireHotelIntakePhotos urls={s.intakePhotos} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReceiptStayId((id) => (id === s.id ? null : s.id))
                    }
                    className="rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    {expandedReceiptStayId === s.id ? "Ascunde bonul" : "Bon / print"}
                  </button>
                  {canWrite ? (
                    <button
                      type="button"
                      disabled={busy === s.id}
                      onClick={() => void checkOut(s.id)}
                      className="rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Eliberează (check-out)
                    </button>
                  ) : null}
                </div>
                {expandedReceiptStayId === s.id ? (
                  <TireHotelReceiptPanel stay={s} supplierName={supplierName} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
