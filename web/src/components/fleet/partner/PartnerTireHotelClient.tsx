"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parsePartnerSupplierQuery } from "@/lib/partner-context";
import type {
  TireHotelCapability,
  TireHotelReleaseKind,
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
import { tireMountedAsLabel, vehicleTireSeasonLabel } from "@/lib/vehicle-wheels-types";
import type { TireMountedAs } from "@/lib/vehicle-wheels-types";
import { TireCustodyProtocolPanel } from "@/components/fleet/partner/TireCustodyProtocolPanel";
import { TireHotelIntakePhotos } from "@/components/fleet/partner/TireHotelIntakePhotos";
import { TireHotelQrPayload } from "@/components/fleet/partner/TireHotelQrPayload";
import { TireHotelReceiptPanel } from "@/components/fleet/partner/TireHotelReceiptPanel";
import {
  openTireCustodyProtocol,
  type TireCustodyProtocolKind,
  type TireCustodyProtocolRecord,
} from "@/lib/tire-custody-api";

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
  const [staysStatus, setStaysStatus] = useState<"active" | "closed" | "all">("active");
  const [filterPlate, setFilterPlate] = useState("");
  const [searchPlate, setSearchPlate] = useState("");
  const [searchHits, setSearchHits] = useState<TireHotelSearchVehicle[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedFeeQuote, setSelectedFeeQuote] = useState<{
    feeCents: number | null;
    rimInch: number | null;
    mountedAs: string | null;
    dominantSize: string | null;
  } | null>(null);
  const [bayCode, setBayCode] = useState("");
  const [binCode, setBinCode] = useState("");
  const [intakePhotoUrlsInput, setIntakePhotoUrlsInput] = useState("");
  const [intakePhotoFileUrls, setIntakePhotoFileUrls] = useState<string[]>([]);
  const [intakePhotoPreviewUrls, setIntakePhotoPreviewUrls] = useState<string[]>([]);
  const [intakeTreadNotes, setIntakeTreadNotes] = useState("");
  const [receiptStay, setReceiptStay] = useState<TireHotelStay | null>(null);
  const [expandedReceiptStayId, setExpandedReceiptStayId] = useState<string | null>(null);
  const [activeProtocol, setActiveProtocol] = useState<TireCustodyProtocolRecord | null>(null);
  const [relocateStayId, setRelocateStayId] = useState<string | null>(null);
  const [relocateBay, setRelocateBay] = useState("");
  const [relocateBin, setRelocateBin] = useState("");
  const [releaseKind, setReleaseKind] = useState<TireHotelReleaseKind>("at_client");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supplierName = capability?.supplierName ?? null;

  const loadStays = useCallback(async () => {
    const fp = filterPlate.trim();
    const p = new URLSearchParams();
    if (qs) {
      for (const [k, v] of new URLSearchParams(qs)) p.set(k, v);
    }
    p.set("status", staysStatus);
    if (fp) p.set("plate", fp);
    const res = await fetch(`/api/partner/tire-hotel/stays?${p.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Nu am putut încărca sejururile");
    const data = (await res.json()) as { items?: TireHotelStay[] };
    setStays(
      (data.items ?? []).map((s) => ({
        ...s,
        intakePhotos: normalizeIntakePhotoUrls(s.intakePhotos),
      })),
    );
  }, [filterPlate, qs, staysStatus]);

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
      setSelectedFeeQuote(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  function selectSetForCheckIn(
    vehicleId: string,
    set: {
      id: string;
      suggestedFeeCents?: number | null;
      rimInch?: number | null;
      mountedAs?: string | null;
      dominantSize?: string | null;
    },
  ) {
    setSelectedSetId(set.id);
    setSelectedVehicleId(vehicleId);
    setSelectedFeeQuote({
      feeCents: set.suggestedFeeCents ?? null,
      rimInch: set.rimInch ?? null,
      mountedAs: set.mountedAs ?? null,
      dominantSize: set.dominantSize ?? null,
    });
  }

  async function checkIn() {
    if (!selectedSetId || !bayCode.trim()) {
      setError("Alege setul și zona (bay)");
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
          bayCode: bayCode.trim(),
          binCode: binCode.trim() || undefined,
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
      setSelectedFeeQuote(null);
      setBayCode("");
      setBinCode("");
      setIntakePhotoUrlsInput("");
      setIntakePhotoFileUrls([]);
      setIntakePhotoPreviewUrls([]);
      setIntakeTreadNotes("");
      await loadStays();
      if (stay) {
        setReceiptStay(stay);
        setExpandedReceiptStayId(null);
        try {
          const protocol = await openTireCustodyProtocol(
            stay.id,
            "check_in",
            supplierId ?? supplierQ.supplierId,
          );
          setActiveProtocol(protocol);
        } catch {
          /* bon remains; protocol optional if API lag */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  async function openProtocol(stayId: string, kind: TireCustodyProtocolKind) {
    if (!canWrite && kind) {
      /* allow open for read via POST getOrCreate — write roles only on server */
    }
    setBusy(`protocol-${stayId}-${kind}`);
    setError(null);
    try {
      const protocol = await openTireCustodyProtocol(
        stayId,
        kind,
        supplierId ?? supplierQ.supplierId,
      );
      setActiveProtocol(protocol);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Protocol eșuat");
    } finally {
      setBusy(null);
    }
  }

  function protocolStatus(
    stay: TireHotelStay,
    kind: TireCustodyProtocolKind,
  ): "signed" | "draft" | "voided" | "missing" {
    const hit = stay.protocols?.find((p) => p.kind === kind);
    if (!hit) return "missing";
    if (hit.status === "voided") return "voided";
    // Treat as signed only when archive hash is present (matches API gate).
    if (hit.status === "signed" && hit.pdfSha256) return "signed";
    if (hit.status === "signed") return "draft";
    return "draft";
  }

  async function checkOut(stayId: string) {
    if (!canWrite) return;
    const stay = stays.find((s) => s.id === stayId);
    if (stay && protocolStatus(stay, "check_in") !== "signed") {
      setError("Finalizează PV check-in (arhivat) înainte de eliberare — lanț de custodie.");
      try {
        const protocol = await openTireCustodyProtocol(
          stayId,
          "check_in",
          supplierId ?? supplierQ.supplierId,
        );
        setActiveProtocol(protocol);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nu am putut deschide PV check-in");
      }
      return;
    }
    const hasReleasePv =
      stay &&
      (protocolStatus(stay, "check_out") === "signed" ||
        protocolStatus(stay, "scrap") === "signed" ||
        protocolStatus(stay, "transfer") === "signed" ||
        protocolStatus(stay, "leasing_return") === "signed" ||
        protocolStatus(stay, "quarantine") === "signed");
    if (stay && !hasReleasePv) {
      setError(
        "Finalizează un PV de eliberare (check-out / casare / transfer / leasing / carantină) înainte de Eliberează.",
      );
      try {
        const protocol = await openTireCustodyProtocol(
          stayId,
          "check_out",
          supplierId ?? supplierQ.supplierId,
        );
        setActiveProtocol(protocol);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nu am putut deschide PV check-out");
      }
      return;
    }
    setBusy(stayId);
    setError(null);
    try {
      const res = await fetch("/api/partner/tire-hotel/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId ?? supplierQ.supplierId,
          stayId,
          releaseKind,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Eliberare eșuată");
      }
      if (receiptStay?.id === stayId) setReceiptStay(null);
      if (expandedReceiptStayId === stayId) setExpandedReceiptStayId(null);
      setActiveProtocol(null);
      await loadStays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  async function relocateStay(stayId: string) {
    if (!canWrite || !relocateBay.trim()) {
      setError("Zona (bay) e obligatorie la mutare");
      return;
    }
    setBusy(`relocate-${stayId}`);
    setError(null);
    try {
      const res = await fetch("/api/partner/tire-hotel/relocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId ?? supplierQ.supplierId,
          stayId,
          bayCode: relocateBay.trim(),
          binCode: relocateBin.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Mutare eșuată");
      }
      setRelocateStayId(null);
      setRelocateBay("");
      setRelocateBin("");
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
          Furnizorul nu are activă capacitatea «Hotel anvelope». În Tip & servicii bifează «Hotel
          anvelope», apasă Salvează servicii, apoi reîncarcă pagina.
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

      {activeProtocol ? (
        <TireCustodyProtocolPanel
          protocol={activeProtocol}
          canWrite={canWrite}
          supplierId={supplierId ?? supplierQ.supplierId}
          onUpdated={(p) => {
            setActiveProtocol(p);
            if (p.status === "signed" || p.status === "voided") {
              void loadStays().catch(() => undefined);
            }
          }}
          onClose={() => setActiveProtocol(null)}
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
                    onClick={() => selectSetForCheckIn(v.id, s)}
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
                      {s.mountedAs
                        ? ` · ${tireMountedAsLabel(
                            s.mountedAs === "tyre_only" ? "tyre_only" : "on_rim",
                          )}`
                        : ""}
                      {s.suggestedFeeCents != null
                        ? ` · ${(s.suggestedFeeCents / 100).toLocaleString("ro-RO")} lei/sezon`
                        : ""}
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
            {selectedFeeQuote ? (
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100/90">
                <p className="font-medium text-emerald-200">Tarif estimat la check-in</p>
                <p className="mt-1">
                  {selectedFeeQuote.feeCents != null
                    ? `${(selectedFeeQuote.feeCents / 100).toLocaleString("ro-RO")} lei / sezon`
                    : "Nesetat pe fișa tarifară a furnizorului"}
                  {selectedFeeQuote.dominantSize
                    ? ` · ${selectedFeeQuote.dominantSize}`
                    : selectedFeeQuote.rimInch != null
                      ? ` · R${selectedFeeQuote.rimInch}`
                      : ""}
                  {selectedFeeQuote.mountedAs
                    ? ` · ${tireMountedAsLabel(
                        selectedFeeQuote.mountedAs === "tyre_only" ? "tyre_only" : "on_rim",
                      )}`
                    : ""}
                </p>
                <p className="mt-1 text-[11px] text-emerald-200/60">
                  Se aplică automat din grila pe diametru / default hotel. Poți confirma fără a
                  introduce manual prețul.
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <input
                value={bayCode}
                onChange={(e) => setBayCode(e.target.value.toUpperCase())}
                placeholder="Zonă / bay (ex. A)"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100"
              />
              <input
                value={binCode}
                onChange={(e) => setBinCode(e.target.value.toUpperCase())}
                placeholder="Bin (ex. 12)"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Locația se salvează ca {bayCode.trim() || "BAY"}
              {binCode.trim() ? `/${binCode.trim()}` : ""}
            </p>
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
          <h2 className="text-base font-medium text-zinc-100">Inventar hotel</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={staysStatus}
              onChange={(e) =>
                setStaysStatus(e.target.value as "active" | "closed" | "all")
              }
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="active">Active</option>
              <option value="closed">Istoric</option>
              <option value="all">Toate</option>
            </select>
            <input
              value={filterPlate}
              onChange={(e) => setFilterPlate(formatTireSetSearchFieldOnChange(e.target.value))}
              onBlur={() => void loadStays().catch(() => undefined)}
              placeholder="Filtru nr. / QR"
              className="w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
            />
          </div>
        </div>
        {canWrite && staysStatus !== "closed" ? (
          <label className="block text-xs text-zinc-500">
            Destinație la eliberare
            <select
              value={releaseKind}
              onChange={(e) => setReleaseKind(e.target.value as TireHotelReleaseKind)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
            >
              <option value="at_client">La client</option>
              <option value="in_transit">În tranzit</option>
              <option value="scrap">Casare</option>
              <option value="quarantine">Carantină</option>
            </select>
          </label>
        ) : null}
        {stays.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {staysStatus === "closed" ? "Niciun sejur închis." : "Niciun set activ în depozit."}
          </p>
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
                    {s.itemCount != null ? ` · ${s.itemCount} buc` : ""}
                  </span>
                  {s.checkOutAt ? (
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                      eliberat
                    </span>
                  ) : null}
                  {(
                    [
                      "check_in",
                      "check_out",
                      "seasonal",
                      "transfer",
                      "scrap",
                      "leasing_return",
                      "quarantine",
                    ] as const
                  ).map((kind) => {
                    const st = protocolStatus(s, kind);
                    if (st === "missing") return null;
                    const label =
                      kind === "check_in"
                        ? "PV in"
                        : kind === "check_out"
                          ? "PV out"
                          : kind === "seasonal"
                            ? "PV sezon"
                            : kind === "transfer"
                              ? "PV transfer"
                              : kind === "scrap"
                                ? "PV casare"
                                : kind === "quarantine"
                                  ? "PV carantină"
                                  : "PV leasing";
                    const tone =
                      st === "signed"
                        ? "rounded bg-emerald-950/60 px-2 py-0.5 text-[10px] text-emerald-200"
                        : st === "voided"
                          ? "rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                          : "rounded bg-amber-950/50 px-2 py-0.5 text-[10px] text-amber-200";
                    const suffix = st === "signed" ? "✓" : st;
                    return (
                      <span key={kind} className={tone}>
                        {label} {suffix}
                      </span>
                    );
                  })}
                  {s.mountedAs ? (
                    <span className="rounded bg-sky-950/50 px-2 py-0.5 text-[10px] text-sky-200">
                      {tireMountedAsLabel(
                        (s.mountedAs as TireMountedAs) === "tyre_only" ? "tyre_only" : "on_rim",
                      )}
                    </span>
                  ) : null}
                  {s.locationCode ? (
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {s.bayCode && s.binCode
                        ? `Bay ${s.bayCode} · Bin ${s.binCode}`
                        : `Raft ${s.locationCode}`}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-500">
                  Check-in {formatCheckIn(s.checkInAt)}
                  {s.checkOutAt ? ` · out ${formatCheckIn(s.checkOutAt)}` : ""}
                  {s.contractRef ? ` · contract ${s.contractRef}` : ""}
                  {s.feeCents != null
                    ? ` · ${(s.feeCents / 100).toLocaleString("ro-RO")} lei`
                    : ""}
                </p>
                {(s.items?.length ?? 0) > 0 ? (
                  <ul className="space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2">
                    {s.items!.map((it) => (
                      <li key={it.assetId} className="text-xs text-zinc-400">
                        <span className="text-zinc-200">
                          {[it.brand, it.model].filter(Boolean).join(" ") || "Anvelopă"}
                        </span>
                        {it.size ? ` · ${it.size}` : ""}
                        {it.treadMm != null ? ` · ${it.treadMm.toFixed(1)} mm` : ""}
                        {it.dot ? ` · DOT ${it.dot}` : ""}
                        {it.serialOrQr ? ` · ${it.serialOrQr}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <TireHotelQrPayload payload={s.qrPayload} />
                {s.intakeTreadNotes?.trim() ? (
                  <p className="whitespace-pre-wrap text-xs text-zinc-400">{s.intakeTreadNotes.trim()}</p>
                ) : null}
                <TireHotelIntakePhotos urls={s.intakePhotos} />
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
                    <>
                      <button
                        type="button"
                        disabled={busy === `protocol-${s.id}-check_in`}
                        onClick={() => void openProtocol(s.id, "check_in")}
                        className="rounded-xl border border-emerald-700/60 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        PV check-in
                      </button>
                      <button
                        type="button"
                        disabled={busy === `protocol-${s.id}-check_out`}
                        onClick={() => void openProtocol(s.id, "check_out")}
                        className="rounded-xl border border-emerald-700/60 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        PV check-out
                      </button>
                      <button
                        type="button"
                        disabled={busy === `protocol-${s.id}-seasonal`}
                        onClick={() => void openProtocol(s.id, "seasonal")}
                        className="rounded-xl border border-emerald-700/60 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        PV sezonier
                      </button>
                      <button
                        type="button"
                        disabled={busy === `protocol-${s.id}-transfer`}
                        onClick={() => void openProtocol(s.id, "transfer")}
                        className="rounded-xl border border-emerald-700/60 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        PV transfer
                      </button>
                      <button
                        type="button"
                        disabled={busy === `protocol-${s.id}-scrap`}
                        onClick={() => void openProtocol(s.id, "scrap")}
                        className="rounded-xl border border-emerald-700/60 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        PV casare
                      </button>
                      <button
                        type="button"
                        disabled={busy === `protocol-${s.id}-leasing_return`}
                        onClick={() => void openProtocol(s.id, "leasing_return")}
                        className="rounded-xl border border-emerald-700/60 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        PV leasing
                      </button>
                      <button
                        type="button"
                        disabled={busy === `protocol-${s.id}-quarantine`}
                        onClick={() => void openProtocol(s.id, "quarantine")}
                        className="rounded-xl border border-emerald-700/60 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        PV carantină
                      </button>
                    </>
                  ) : null}
                  {canWrite && !s.checkOutAt ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRelocateStayId(s.id);
                          setRelocateBay(s.bayCode ?? "");
                          setRelocateBin(s.binCode ?? "");
                        }}
                        className="rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                      >
                        Mută raft
                      </button>
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => void checkOut(s.id)}
                        className="rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                        title={
                          protocolStatus(s, "check_out") === "signed" ||
                          protocolStatus(s, "scrap") === "signed" ||
                          protocolStatus(s, "transfer") === "signed" ||
                          protocolStatus(s, "leasing_return") === "signed" ||
                          protocolStatus(s, "quarantine") === "signed"
                            ? "PV eliberare semnat — eliberare permisă"
                            : "Necesită PV check-out / casare / transfer / leasing / carantină semnat"
                        }
                      >
                        Eliberează
                        {protocolStatus(s, "check_out") === "signed" ||
                        protocolStatus(s, "scrap") === "signed" ||
                        protocolStatus(s, "transfer") === "signed" ||
                        protocolStatus(s, "leasing_return") === "signed" ||
                        protocolStatus(s, "quarantine") === "signed"
                          ? ` (${releaseKind === "at_client" ? "client" : releaseKind})`
                          : " · după PV eliberare"}
                      </button>
                    </>
                  ) : null}
                </div>
                {relocateStayId === s.id && !s.checkOutAt ? (
                  <div className="grid gap-2 rounded-lg border border-zinc-700 bg-zinc-950/50 p-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={relocateBay}
                      onChange={(e) => setRelocateBay(e.target.value.toUpperCase())}
                      placeholder="Bay"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    />
                    <input
                      value={relocateBin}
                      onChange={(e) => setRelocateBin(e.target.value.toUpperCase())}
                      placeholder="Bin"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    />
                    <button
                      type="button"
                      disabled={busy === `relocate-${s.id}`}
                      onClick={() => void relocateStay(s.id)}
                      className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Salvează
                    </button>
                  </div>
                ) : null}
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
