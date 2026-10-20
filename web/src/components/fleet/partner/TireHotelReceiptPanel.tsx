"use client";

import type { TireHotelStay } from "@/lib/partner-tire-hotel-api";
import { vehicleTireSeasonLabel } from "@/lib/vehicle-wheels-types";
import { TireHotelQrPayload } from "@/components/fleet/partner/TireHotelQrPayload";

export type TireHotelReceiptProps = {
  stay: TireHotelStay;
  supplierName: string | null;
  onClose?: () => void;
  autoFocusPrint?: boolean;
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TireHotelReceiptPanel({
  stay,
  supplierName,
  onClose,
  autoFocusPrint,
}: TireHotelReceiptProps) {
  function printReceipt() {
    window.print();
  }

  function downloadText() {
    const lines = [
      "Bon depozitare anvelope — Fleet Enterprise",
      "",
      supplierName ? `Furnizor: ${supplierName}` : "",
      `Nr. înmatriculare: ${stay.plate}`,
      `Sezon set: ${vehicleTireSeasonLabel(stay.season)}`,
      stay.setName?.trim() ? `Denumire set: ${stay.setName.trim()}` : "",
      stay.locationCode ? `Locație depozit: ${stay.locationCode}` : "",
      `Check-in: ${formatDateTime(stay.checkInAt)}`,
      `Cod QR set: ${stay.qrPayload}`,
      stay.intakeTreadNotes?.trim() ? `Note profil: ${stay.intakeTreadNotes.trim()}` : "",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hotel-anvelope-${stay.plate.replace(/\s+/g, "")}-${stay.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tire-hotel-receipt-root space-y-3 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4 print:border-0 print:bg-white print:p-6 print:text-black">
      <div className="flex flex-wrap items-start justify-between gap-2 print:hidden">
        <h3 className="text-sm font-medium text-emerald-100">Bon check-in</h3>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Închide
          </button>
        ) : null}
      </div>

      <div className="hidden print:block">
        <p className="text-lg font-semibold">Bon depozitare anvelope</p>
        <p className="text-sm text-zinc-600">Fleet Enterprise</p>
      </div>

      <dl className="grid gap-2 text-sm">
        {supplierName ? (
          <div>
            <dt className="text-xs text-zinc-500 print:text-zinc-600">Furnizor</dt>
            <dd className="text-zinc-100 print:text-black">{supplierName}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-zinc-500 print:text-zinc-600">Vehicul</dt>
          <dd className="font-medium text-zinc-100 print:text-black">{stay.plate}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 print:text-zinc-600">Set / sezon</dt>
          <dd className="text-zinc-200 print:text-black">
            {stay.setName?.trim()
              ? `${stay.setName.trim()} · ${vehicleTireSeasonLabel(stay.season)}`
              : vehicleTireSeasonLabel(stay.season)}
          </dd>
        </div>
        {stay.locationCode ? (
          <div>
            <dt className="text-xs text-zinc-500 print:text-zinc-600">Locație (raft)</dt>
            <dd className="text-zinc-200 print:text-black">{stay.locationCode}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-zinc-500 print:text-zinc-600">Check-in</dt>
          <dd className="text-zinc-200 print:text-black">{formatDateTime(stay.checkInAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 print:text-zinc-600">Cod QR set</dt>
          <dd className="print:hidden">
            <TireHotelQrPayload payload={stay.qrPayload} />
          </dd>
          <dd className="hidden break-all font-mono text-xs print:block">{stay.qrPayload}</dd>
        </div>
        {stay.intakeTreadNotes?.trim() ? (
          <div>
            <dt className="text-xs text-zinc-500 print:text-zinc-600">Note profil la recepție</dt>
            <dd className="whitespace-pre-wrap text-zinc-300 print:text-black">
              {stay.intakeTreadNotes.trim()}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          autoFocus={autoFocusPrint}
          onClick={printReceipt}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          Printează
        </button>
        <button
          type="button"
          onClick={downloadText}
          className="rounded-xl border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Descarcă text
        </button>
      </div>
    </div>
  );
}
