"use client";

export function VehicleDsrPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
    >
      Printează / PDF
    </button>
  );
}
