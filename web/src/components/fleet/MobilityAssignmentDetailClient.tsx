"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import {
  fleetJsonHeaders,
  mobilityBrowserBase,
  mobilityDeliveryModeLabel,
  mobilityStatusLabel,
  type MobilityAssignmentRecord,
} from "@/lib/mobility-api";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO");
}

export function MobilityAssignmentDetailClient({
  initial,
  canWrite,
}: {
  initial: MobilityAssignmentRecord;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [row, setRow] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(status: "returned" | "cancelled") {
    if (!window.confirm(status === "returned" ? "Marchezi returnarea mașinii?" : "Anulezi alocarea?")) return;
    setPending(true);
    setError(null);
    try {
      const body =
        status === "returned"
          ? { status, returnedAt: new Date().toISOString() }
          : { status };
      const res = await fetch(`${mobilityBrowserBase}/assignments/${row.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const updated = (await res.json()) as MobilityAssignmentRecord;
      setRow(updated);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <FleetPageMain>
      <Link href="/fleet/mobility/replacement-cars" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Mașini la schimb
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-2xl font-semibold text-violet-300">{row.displayNumber ?? "MOB"}</p>
          <p className="mt-1 text-sm text-zinc-400">{mobilityStatusLabel(row.status)}</p>
        </div>
        {canWrite && (row.status === "active" || row.status === "reserved") ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void patchStatus("returned")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Marchează returnare
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void patchStatus("cancelled")}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Anulează
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Mașină acoperită</dt>
          <dd className="mt-1 font-mono text-zinc-100">{row.coveredVehicleReg ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Mașină schimb</dt>
          <dd className="mt-1 font-mono text-zinc-100">{row.replacementRegistration ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Client</dt>
          <dd className="mt-1 text-zinc-100">{row.clientLegalName}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Furnizor Rent</dt>
          <dd className="mt-1 text-zinc-100">{row.supplierLegalName ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Mod predare</dt>
          <dd className="mt-1 text-zinc-100">
            {row.deliveryMode ? mobilityDeliveryModeLabel(row.deliveryMode) : "—"}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Utilizator</dt>
          <dd className="mt-1 text-zinc-100">{row.handoverUserLabel ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Predare (OUT)</dt>
          <dd className="mt-1 text-zinc-100">{fmt(row.handoverAt)}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Returnare (IN)</dt>
          <dd className="mt-1 text-zinc-100">{fmt(row.returnedAt)}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Ore imobilizare (snapshot)</dt>
          <dd className="mt-1 text-zinc-100">{row.eligibilityHours ?? "—"}h</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <dt className="text-xs uppercase text-zinc-500">Comandă service</dt>
          <dd className="mt-1">
            <Link href={`/fleet/work-orders/${row.workOrderId}`} className="text-sky-300 hover:underline">
              {row.workOrderDisplayNumber ?? row.workOrderId}
            </Link>
          </dd>
        </div>
        {row.sourceTicketId ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <dt className="text-xs uppercase text-zinc-500">Tichet CRM</dt>
            <dd className="mt-1">
              <Link href={`/fleet/tickets/${row.sourceTicketId}`} className="text-sky-300 hover:underline">
                Deschide tichet
              </Link>
            </dd>
          </div>
        ) : null}
        {row.waivedReason ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:col-span-2">
            <dt className="text-xs uppercase text-zinc-500">Motiv renunțare</dt>
            <dd className="mt-1 text-zinc-100">{row.waivedReason}</dd>
          </div>
        ) : null}
        {row.notes ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:col-span-2">
            <dt className="text-xs uppercase text-zinc-500">Note</dt>
            <dd className="mt-1 text-zinc-100">{row.notes}</dd>
          </div>
        ) : null}
      </dl>
    </FleetPageMain>
  );
}
