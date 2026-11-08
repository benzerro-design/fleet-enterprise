"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { TireMovementLedger } from "@/components/fleet/TireMovementLedger";
import { TirePurchaseDocsEditor } from "@/components/fleet/TirePurchaseDocsEditor";
import { ListColumnPicker } from "@/components/fleet/ListColumnPicker";
import {
  defaultPartnerTireHotelInventarLayout,
  PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS,
  readPartnerTireHotelInventarLayout,
  visiblePartnerTireHotelInventarColumns,
  writePartnerTireHotelInventarLayout,
  type PartnerTireHotelInventarColumnKey,
  type PartnerTireHotelInventarLayout,
} from "@/lib/partner-tire-hotel-inventar-columns";

const STAYS_PAGE_SIZE = 50;

type Props = {
  canWrite: boolean;
  /** Admin flotă în view-as: read (căutare/inventar) da, mutații nu. */
  adminMode?: boolean;
  supplierId?: string;
  /** inventar = listă tip flotă; check-in = check-in + import (pagină separată). */
  mode?: "inventar" | "check-in";
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

function PartnerStayLedgerTabs({ stay }: { stay: TireHotelStay }) {
  const [mode, setMode] = useState<"vehicle" | "asset" | "client">("vehicle");
  const assetId = stay.items?.[0]?.assetId ?? "";
  const clientId = stay.clientId?.trim() ?? "";
  const entityId =
    mode === "asset" ? assetId : mode === "client" ? clientId : stay.vehicleId;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { mode: "vehicle" as const, label: "Vehicul", enabled: !!stay.vehicleId },
            { mode: "asset" as const, label: "Anvelopă", enabled: !!assetId },
            { mode: "client" as const, label: "Client", enabled: !!clientId },
          ] as const
        ).map((tab) => (
          <button
            key={tab.mode}
            type="button"
            disabled={!tab.enabled}
            onClick={() => setMode(tab.mode)}
            className={`rounded-md border px-2 py-1 text-[11px] disabled:opacity-40 ${
              mode === tab.mode
                ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <TireMovementLedger
        apiBase="/api/partner/tire-hotel/ledger"
        mode={mode}
        entityId={entityId}
        title={
          mode === "asset"
            ? "Fișă mișcări (anvelopă)"
            : mode === "client"
              ? "Fișă mișcări (client)"
              : "Fișă mișcări (vehicul)"
        }
      />
    </div>
  );
}

export function PartnerTireHotelClient({
  canWrite,
  adminMode = false,
  supplierId,
  mode = "inventar",
}: Props) {
  const router = useRouter();
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

  const contextTicketId = (searchParams.get("ticketId") ?? "").trim() || null;
  const contextPlate = (searchParams.get("plate") ?? "").trim();

  const inventarHref = useMemo(() => {
    const p = new URLSearchParams();
    const sid = supplierId ?? supplierQ.supplierId;
    if (sid) p.set("supplierId", sid);
    const s = p.toString();
    return `/fleet/partner/tire-hotel${s ? `?${s}` : ""}`;
  }, [supplierId, supplierQ.supplierId]);

  const checkInHref = useMemo(() => {
    const p = new URLSearchParams();
    const sid = supplierId ?? supplierQ.supplierId;
    if (sid) p.set("supplierId", sid);
    const s = p.toString();
    return `/fleet/partner/tire-hotel/check-in${s ? `?${s}` : ""}`;
  }, [supplierId, supplierQ.supplierId]);

  const [capability, setCapability] = useState<TireHotelCapability | null>(null);
  const [stays, setStays] = useState<TireHotelStay[]>([]);
  const [staysStatus, setStaysStatus] = useState<"active" | "closed" | "all">("active");
  const [filterPlate, setFilterPlate] = useState("");
  const [searchPlate, setSearchPlate] = useState(contextPlate);
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
  const [expandedInventarStayId, setExpandedInventarStayId] = useState<string | null>(null);
  const [staysSkip, setStaysSkip] = useState(0);
  const [staysTotal, setStaysTotal] = useState(0);
  const [activeProtocol, setActiveProtocol] = useState<TireCustodyProtocolRecord | null>(null);
  const [relocateStayId, setRelocateStayId] = useState<string | null>(null);
  const [relocateBay, setRelocateBay] = useState("");
  const [relocateBin, setRelocateBin] = useState("");
  const [transferStayId, setTransferStayId] = useState<string | null>(null);
  const [transferToSupplierId, setTransferToSupplierId] = useState("");
  const [transferBay, setTransferBay] = useState("");
  const [transferBin, setTransferBin] = useState("");
  const [transferHandoffOnly, setTransferHandoffOnly] = useState(false);
  const [invoiceStayId, setInvoiceStayId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState("");
  const [releaseKind, setReleaseKind] = useState<TireHotelReleaseKind>("at_client");
  const [scrapAccountingNote, setScrapAccountingNote] = useState("");
  const [costSummaryByStay, setCostSummaryByStay] = useState<
    Record<string, { lines: string[]; costEntryId: string }>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importCsv, setImportCsv] = useState(
    "plate,season,mountedAs,brand,model,size,location,bay\n",
  );
  const [importResult, setImportResult] = useState<string | null>(null);
  const [inventarLayout, setInventarLayout] = useState<PartnerTireHotelInventarLayout>(() =>
    defaultPartnerTireHotelInventarLayout(),
  );
  const [showInventarColumns, setShowInventarColumns] = useState(false);

  useEffect(() => {
    setInventarLayout(readPartnerTireHotelInventarLayout());
  }, []);

  const inventarColumns = useMemo(
    () => visiblePartnerTireHotelInventarColumns(inventarLayout),
    [inventarLayout],
  );

  function persistInventarLayout(next: PartnerTireHotelInventarLayout) {
    setInventarLayout(next);
    writePartnerTireHotelInventarLayout(next);
  }

  const inventarCellPad =
    inventarLayout.density === "simple" ? "px-2 py-1" : "px-2 py-2";
  const inventarTableClass = [
    "min-w-full text-left text-xs",
    inventarLayout.colLines ? "[&_th]:border-r [&_td]:border-r [&_th]:border-zinc-800/80 [&_td]:border-zinc-800/60" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const inventarBodyClass = inventarLayout.rowLines
    ? "divide-y divide-zinc-800/80"
    : "";

  const supplierName = capability?.supplierName ?? null;

  const loadStays = useCallback(async () => {
    const fp = filterPlate.trim();
    const p = new URLSearchParams();
    if (qs) {
      for (const [k, v] of new URLSearchParams(qs)) p.set(k, v);
    }
    p.set("status", staysStatus);
    p.set("take", String(STAYS_PAGE_SIZE));
    p.set("skip", String(staysSkip));
    if (fp) p.set("plate", fp);
    const res = await fetch(`/api/partner/tire-hotel/stays?${p.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Nu am putut încărca sejururile");
    const data = (await res.json()) as {
      items?: TireHotelStay[];
      total?: number;
      skip?: number;
    };
    setStaysTotal(data.total ?? data.items?.length ?? 0);
    setStays(
      (data.items ?? []).map((s) => ({
        ...s,
        intakePhotos: normalizeIntakePhotoUrls(s.intakePhotos),
      })),
    );
  }, [filterPlate, qs, staysSkip, staysStatus]);

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
    if (mode !== "inventar") return;
    void loadStays().catch((e: Error) => setError(e.message));
  }, [capability?.hasTireStorage, loadStays, mode]);

  useEffect(() => {
    if (mode !== "check-in") return;
    if (!contextPlate.trim() || contextPlate.trim().length < 2) return;
    setSearchPlate(contextPlate);
    const t = window.setTimeout(() => {
      void (async () => {
        setError(null);
        setBusy("search");
        try {
          const res = await fetch(
            `/api/partner/tire-hotel/search?${qs}&plate=${encodeURIComponent(contextPlate.trim())}`,
          );
          if (!res.ok) throw new Error("Căutare eșuată");
          const data = (await res.json()) as { vehicles?: TireHotelSearchVehicle[] };
          setSearchHits(data.vehicles ?? []);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Eroare");
        } finally {
          setBusy(null);
        }
      })();
    }, 50);
    return () => window.clearTimeout(t);
  }, [mode, contextPlate, qs]);

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

  async function runImport(dryRun: boolean) {
    setError(null);
    setImportResult(null);
    setBusy(dryRun ? "import-dry" : "import-apply");
    try {
      const body: Record<string, string> = { csv: importCsv };
      const sid = supplierId ?? supplierQ.supplierId;
      if (sid) body.supplierId = sid;
      const res = await fetch(
        dryRun
          ? "/api/partner/tire-hotel/import-sets/dry-run"
          : "/api/partner/tire-hotel/import-sets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        ok?: boolean;
        rows?: number;
        validRows?: number;
        created?: number;
        updated?: number;
        checkedIn?: number;
        skipped?: number;
        errors?: string[];
      };
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      const lines = [
        dryRun ? "Dry-run" : "Import aplicat",
        `Rânduri: ${data.rows ?? 0}`,
        data.validRows != null ? `Valide: ${data.validRows}` : null,
        data.created != null ? `Create: ${data.created}` : null,
        data.updated != null ? `Actualizate: ${data.updated}` : null,
        data.checkedIn != null ? `Check-in hotel: ${data.checkedIn}` : null,
        data.skipped != null ? `Omise: ${data.skipped}` : null,
        data.ok === false ? "Cu erori / omisiuni" : "OK",
        ...(data.errors?.length ? ["", ...data.errors.slice(0, 40)] : []),
      ].filter(Boolean);
      setImportResult(lines.join("\n"));
      if (!dryRun) await loadStays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import eșuat");
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
          ticketId: contextTicketId || undefined,
          sourceSystem: contextTicketId ? "partner_tire_request" : undefined,
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
      if (mode === "check-in") {
        router.push(inventarHref);
        return;
      }
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
          accountingNote:
            releaseKind === "scrap" && scrapAccountingNote.trim()
              ? scrapAccountingNote.trim()
              : undefined,
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

  async function transformStayToCost(stayId: string, withInvoice = false) {
    if (!canWrite) return;
    setBusy(`cost-${stayId}`);
    setError(null);
    try {
      const res = await fetch("/api/partner/tire-hotel/transform-stay-to-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId ?? supplierQ.supplierId,
          stayId,
          ...(withInvoice
            ? {
                invoiceNumber: invoiceNumber.trim() || undefined,
                invoiceDate: invoiceDate.trim() || undefined,
                invoiceAttachmentUrl: invoiceAttachmentUrl.trim() || undefined,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Cost eșuat");
      }
      const data = (await res.json()) as {
        costEntryId?: string | null;
        summary?: { printable?: { lines: string[]; costEntryId: string } | null };
      };
      if (data.summary?.printable) {
        setCostSummaryByStay((prev) => ({
          ...prev,
          [stayId]: {
            costEntryId: data.summary!.printable!.costEntryId,
            lines: data.summary!.printable!.lines,
          },
        }));
      }
      if (withInvoice) {
        setInvoiceStayId(null);
        setInvoiceNumber("");
        setInvoiceDate("");
        setInvoiceAttachmentUrl("");
      }
      await loadStays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  async function transferStay(stayId: string) {
    if (!canWrite) return;
    if (!transferToSupplierId.trim()) {
      setError("Alege furnizorul destinație");
      return;
    }
    if (!transferHandoffOnly && !transferBay.trim()) {
      setError("Bay obligatoriu la transfer hotel (sau bifează doar predare)");
      return;
    }
    setBusy(`transfer-${stayId}`);
    setError(null);
    try {
      const res = await fetch("/api/partner/tire-hotel/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId ?? supplierQ.supplierId,
          stayId,
          toSupplierId: transferToSupplierId.trim(),
          bayCode: transferBay.trim() || undefined,
          binCode: transferBin.trim() || undefined,
          handoffOnly: transferHandoffOnly || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Transfer eșuat");
      }
      setTransferStayId(null);
      setTransferToSupplierId("");
      setTransferBay("");
      setTransferBin("");
      setTransferHandoffOnly(false);
      await loadStays();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusy(null);
    }
  }

  async function loadCostSummary(stayId: string) {
    try {
      const p = new URLSearchParams();
      const sid = supplierId ?? supplierQ.supplierId;
      if (sid) p.set("supplierId", sid);
      const res = await fetch(
        `/api/partner/tire-hotel/stays/${encodeURIComponent(stayId)}/cost-summary?${p.toString()}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        printable?: { lines: string[]; costEntryId: string } | null;
      };
      if (data.printable) {
        setCostSummaryByStay((prev) => ({
          ...prev,
          [stayId]: { costEntryId: data.printable!.costEntryId, lines: data.printable!.lines },
        }));
      }
    } catch {
      /* ignore */
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
    <div
      className={
        mode === "inventar"
          ? "flex w-full flex-col gap-4 pb-24"
          : "mx-auto flex max-w-lg flex-col gap-6 pb-24"
      }
    >
      {adminMode && !canWrite ? (
        <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Vizualizare admin — căutare și inventar disponibile; check-in, eliberare, relocare și PV
          blocate.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {mode === "inventar" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Listă sejururi active / istoric — check-in și import sunt pe pagină separată.
          </p>
          <Link
            href={checkInHref}
            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-600"
          >
            Check-in / import →
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={inventarHref} className="text-xs text-sky-400 hover:underline">
            ← Inventar hotel
          </Link>
          {contextTicketId ? (
            <p className="text-[11px] text-emerald-200/90">
              Context solicitare · tichet {contextTicketId.slice(0, 10)}…
              {contextPlate ? ` · ${contextPlate}` : ""}
            </p>
          ) : null}
        </div>
      )}

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

      {mode === "check-in" ? (
      <>
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
            disabled={busy === "search"}
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
                        ? ` · ${(s.suggestedFeeCents / 100).toLocaleString("ro-RO")} lei (buc×lună, min.)`
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
                    ? `${(selectedFeeQuote.feeCents / 100).toLocaleString("ro-RO")} lei (bucăți × lună calendaristică, min. facturabil)`
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
                  Unitate: RON/bucată/lună din grila hotel. Total = bucăți × unitate × luni min.
                  Poți confirma fără preț manual.
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

      {canWrite ? (
        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div>
            <h2 className="text-base font-medium text-zinc-100">Import CSV seturi</h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Coloane: plate, season, mountedAs, brand, model, size, location (at_client|hotel),
              bay (obligatoriu pentru hotel). Nu creează vehicule noi — plate trebuie să existe.
            </p>
          </div>
          <textarea
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === "import-dry" || busy === "import-apply"}
              onClick={() => void runImport(true)}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              Dry-run
            </button>
            <button
              type="button"
              disabled={busy === "import-dry" || busy === "import-apply"}
              onClick={() => void runImport(false)}
              className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
            >
              Aplică import
            </button>
          </div>
          {importResult ? (
            <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 text-[11px] text-zinc-300">
              {importResult}
            </pre>
          ) : null}
        </section>
      ) : null}
      </>
      ) : null}

      {mode === "inventar" ? (
      <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-medium text-zinc-100">Inventar hotel</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  persistInventarLayout({ ...inventarLayout, density: "detailed" })
                }
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  inventarLayout.density === "detailed"
                    ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                    : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                Detaliat
              </button>
              <button
                type="button"
                onClick={() =>
                  persistInventarLayout({ ...inventarLayout, density: "simple" })
                }
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  inventarLayout.density === "simple"
                    ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                    : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setShowInventarColumns((v) => !v)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-900"
              >
                {showInventarColumns ? "Închide coloane" : "Coloane"}
              </button>
            </div>
            <select
              value={staysStatus}
              onChange={(e) => {
                setStaysSkip(0);
                setExpandedInventarStayId(null);
                setStaysStatus(e.target.value as "active" | "closed" | "all");
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="active">Active</option>
              <option value="closed">Istoric</option>
              <option value="all">Toate</option>
            </select>
            <input
              value={filterPlate}
              onChange={(e) => setFilterPlate(formatTireSetSearchFieldOnChange(e.target.value))}
              onBlur={() => {
                setStaysSkip(0);
                void loadStays().catch(() => undefined);
              }}
              placeholder="Filtru nr. / QR"
              className="w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
            />
          </div>
        </div>
        {showInventarColumns ? (
          <ListColumnPicker
            title="Coloane inventar hotel"
            columns={PARTNER_TIRE_HOTEL_INVENTAR_COLUMNS}
            layout={inventarLayout}
            onChange={(layout) =>
              persistInventarLayout({
                ...inventarLayout,
                order: layout.order,
                hidden: layout.hidden,
                rowLines: layout.rowLines,
                colLines: layout.colLines,
              })
            }
            onReset={() => persistInventarLayout(defaultPartnerTireHotelInventarLayout())}
            onClose={() => setShowInventarColumns(false)}
          />
        ) : null}
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
        {canWrite && releaseKind === "scrap" ? (
          <input
            value={scrapAccountingNote}
            onChange={(e) => setScrapAccountingNote(e.target.value)}
            placeholder="Notă contabilitate (opțional)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
          />
        ) : null}
        <a
          href={`/api/partner/tire-hotel/stays.csv?${qs}&status=${encodeURIComponent(staysStatus)}`}
          className="inline-block text-[11px] text-violet-300 hover:text-violet-200"
        >
          Export CSV sejururi
        </a>
        {stays.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {staysStatus === "closed" ? "Niciun sejur închis." : "Niciun set activ în depozit."}
          </p>
        ) : (
          <>
            <p className="text-[11px] text-zinc-500">
              {staysTotal > STAYS_PAGE_SIZE
                ? `Afișate ${staysSkip + 1}–${Math.min(staysSkip + stays.length, staysTotal)} din ${staysTotal}`
                : `${stays.length} sejururi`}
            </p>
            <div className="-mx-1 overflow-x-auto rounded-xl border border-zinc-800">
              <table className={inventarTableClass}>
                <thead className="border-b border-zinc-800 bg-zinc-900/60 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    {inventarColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`${inventarCellPad} font-medium ${col.key === "actions" ? "w-8" : ""}`}
                      >
                        {col.key === "actions" ? "" : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={inventarBodyClass}>
                  {stays.map((s) => {
                    const pvIn = protocolStatus(s, "check_in");
                    const pvSigned =
                      pvIn === "signed" ||
                      protocolStatus(s, "check_out") === "signed";
                    const cells: Record<PartnerTireHotelInventarColumnKey, ReactNode> = {
                      plate: (
                        <>
                          {s.plate}
                          {s.checkOutAt ? (
                            <span className="ml-1 text-[10px] text-zinc-500">out</span>
                          ) : null}
                        </>
                      ),
                      set: (
                        <>
                          {s.setName?.trim() || vehicleTireSeasonLabel(s.season)}
                          {s.itemCount != null ? ` · ${s.itemCount}b` : ""}
                        </>
                      ),
                      location: s.bayCode
                        ? `${s.bayCode}${s.binCode ? `/${s.binCode}` : ""}`
                        : (s.locationCode ?? "—"),
                      checkIn: formatCheckIn(s.checkInAt),
                      fee:
                        s.feeCents != null
                          ? `${(s.feeCents / 100).toLocaleString("ro-RO")} lei`
                          : "—",
                      pv: (
                        <span
                          className={
                            pvSigned
                              ? "text-emerald-400"
                              : pvIn === "missing"
                                ? "text-zinc-600"
                                : "text-amber-300"
                          }
                        >
                          {pvSigned ? "✓" : pvIn === "missing" ? "—" : "…"}
                        </span>
                      ),
                      actions: expandedInventarStayId === s.id ? "▲" : "▼",
                    };
                    return (
                      <tr
                        key={s.id}
                        className={`cursor-pointer hover:bg-zinc-900/50 ${expandedInventarStayId === s.id ? "bg-zinc-900/40" : ""}`}
                        onClick={() =>
                          setExpandedInventarStayId((id) => (id === s.id ? null : s.id))
                        }
                      >
                        {inventarColumns.map((col) => (
                          <td
                            key={col.key}
                            className={`${inventarCellPad} ${
                              col.key === "plate"
                                ? "font-medium text-zinc-100"
                                : col.key === "actions"
                                  ? "text-zinc-500"
                                  : col.key === "pv"
                                    ? ""
                                    : "text-zinc-400"
                            }`}
                          >
                            {cells[col.key]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {staysTotal > STAYS_PAGE_SIZE ? (
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                <button
                  type="button"
                  disabled={staysSkip <= 0}
                  onClick={() => setStaysSkip((v) => Math.max(0, v - STAYS_PAGE_SIZE))}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 disabled:opacity-40"
                >
                  Înapoi
                </button>
                <span>
                  Pagina {Math.floor(staysSkip / STAYS_PAGE_SIZE) + 1} /{" "}
                  {Math.max(1, Math.ceil(staysTotal / STAYS_PAGE_SIZE))}
                </span>
                <button
                  type="button"
                  disabled={staysSkip + STAYS_PAGE_SIZE >= staysTotal}
                  onClick={() => setStaysSkip((v) => v + STAYS_PAGE_SIZE)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 disabled:opacity-40"
                >
                  Înainte
                </button>
              </div>
            ) : null}
            {stays.map((s) =>
              expandedInventarStayId !== s.id ? null : (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
                >
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
                  {s.costEntryId || (s.feeCents != null && s.feeCents > 0) ? (
                    <>
                      <button
                        type="button"
                        disabled={busy === `cost-${s.id}`}
                        onClick={() => {
                          if (s.costEntryId) void loadCostSummary(s.id);
                          else void transformStayToCost(s.id);
                        }}
                        className="rounded-xl border border-amber-800/50 py-3 text-sm font-medium text-amber-100 hover:bg-amber-950/30 disabled:opacity-50"
                      >
                        {s.costEntryId ? "Sumar cost" : "Generează cost"}
                      </button>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceStayId((id) => (id === s.id ? null : s.id));
                            setTransferStayId(null);
                            setRelocateStayId(null);
                          }}
                          className="rounded-xl border border-amber-800/50 py-3 text-sm font-medium text-amber-100 hover:bg-amber-950/30"
                        >
                          {invoiceStayId === s.id ? "Ascunde factură" : "Factură pe cost"}
                        </button>
                      ) : null}
                    </>
                  ) : null}
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
                          setTransferStayId(null);
                          setInvoiceStayId(null);
                        }}
                        className="rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                      >
                        Mută raft
                      </button>
                      {(capability?.transferTargets?.length ?? 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTransferStayId((id) => (id === s.id ? null : s.id));
                            setTransferToSupplierId(capability?.transferTargets?.[0]?.id ?? "");
                            setTransferBay(s.bayCode ?? "");
                            setTransferBin(s.binCode ?? "");
                            setTransferHandoffOnly(false);
                            setRelocateStayId(null);
                            setInvoiceStayId(null);
                          }}
                          className="rounded-xl border border-sky-800/50 py-3 text-sm font-medium text-sky-100 hover:bg-sky-950/30"
                        >
                          {transferStayId === s.id ? "Ascunde transfer" : "Transfer partener"}
                        </button>
                      ) : null}
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
                {costSummaryByStay[s.id] ? (
                  <pre className="whitespace-pre-wrap rounded-lg border border-amber-900/40 bg-amber-950/20 p-2 text-[11px] text-amber-100/90">
                    {costSummaryByStay[s.id]!.lines.join("\n")}
                  </pre>
                ) : null}
                {invoiceStayId === s.id ? (
                  <div className="grid gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-2 sm:grid-cols-2">
                    <input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Nr. factură"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    />
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    />
                    <input
                      value={invoiceAttachmentUrl}
                      onChange={(e) => setInvoiceAttachmentUrl(e.target.value)}
                      placeholder="URL atașament factură (opțional)"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 sm:col-span-2"
                    />
                    <button
                      type="button"
                      disabled={busy === `cost-${s.id}`}
                      onClick={() => void transformStayToCost(s.id, true)}
                      className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
                    >
                      Salvează factură pe cost
                    </button>
                  </div>
                ) : null}
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
                {transferStayId === s.id && !s.checkOutAt ? (
                  <div className="grid gap-2 rounded-lg border border-sky-900/40 bg-sky-950/20 p-2 sm:grid-cols-2">
                    <select
                      value={transferToSupplierId}
                      onChange={(e) => setTransferToSupplierId(e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 sm:col-span-2"
                    >
                      <option value="">— furnizor destinație —</option>
                      {(capability?.transferTargets ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.legalName}
                        </option>
                      ))}
                    </select>
                    <input
                      value={transferBay}
                      onChange={(e) => setTransferBay(e.target.value.toUpperCase())}
                      placeholder="Bay destinație"
                      disabled={transferHandoffOnly}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 disabled:opacity-50"
                    />
                    <input
                      value={transferBin}
                      onChange={(e) => setTransferBin(e.target.value.toUpperCase())}
                      placeholder="Bin (opțional)"
                      disabled={transferHandoffOnly}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 disabled:opacity-50"
                    />
                    <label className="flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={transferHandoffOnly}
                        onChange={(e) => setTransferHandoffOnly(e.target.checked)}
                      />
                      Doar predare documentată (fără mutare raft la destinație)
                    </label>
                    <button
                      type="button"
                      disabled={busy === `transfer-${s.id}`}
                      onClick={() => void transferStay(s.id)}
                      className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
                    >
                      Confirmă transfer
                    </button>
                  </div>
                ) : null}
                {expandedReceiptStayId === s.id ? (
                  <TireHotelReceiptPanel stay={s} supplierName={supplierName} />
                ) : null}
                <TirePurchaseDocsEditor
                  saveUrl={`/api/partner/tire-hotel/sets/${encodeURIComponent(s.setId)}/docs`}
                  initialWarrantyUrl={s.warrantyCertificateUrl}
                  initialPurchaseDocs={s.purchaseDocs}
                  canWrite={canWrite}
                  onSaved={(next) => {
                    setStays((prev) =>
                      prev.map((row) =>
                        row.id === s.id
                          ? {
                              ...row,
                              warrantyCertificateUrl: next.warrantyCertificateUrl,
                              purchaseDocs: next.purchaseDocs,
                            }
                          : row,
                      ),
                    );
                  }}
                />
                <PartnerStayLedgerTabs stay={s} />
              </div>
              ),
            )}
          </>
        )}
      </section>
      ) : null}
    </div>
  );
}
