"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ClientSelect } from "@/components/fleet/ClientSelect";
import { fleetBrowserBase } from "@/lib/fleet-api";
import type { OpsVehicleOption } from "@/lib/ops-form-context";
import { fleetJsonHeaders, ticketsBrowserBase, type TicketRecord } from "@/lib/tickets-api";
import { TIRE_GESTIUNE_OPS, type TireGestiuneOp } from "@/lib/tire-gestiune";

type HotelSupplier = { id: string; legalName: string };

type Props = {
  vehicles: OpsVehicleOption[];
  initialClientId?: string;
  initialVehicleId?: string;
};

export function GestiuneRequestForm({
  vehicles,
  initialClientId = "",
  initialVehicleId = "",
}: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId);
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [gestiuneOp, setGestiuneOp] = useState<TireGestiuneOp>("cazare");
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState<HotelSupplier[]>([]);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientVehicles = useMemo(() => {
    if (!clientId.trim()) return vehicles;
    return vehicles.filter(
      (v) => v.clientId === clientId || v.clientId.toLowerCase() === clientId.toLowerCase(),
    );
  }, [vehicles, clientId]);

  useEffect(() => {
    if (!vehicleId) {
      setSuppliers([]);
      setSupplierId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${fleetBrowserBase}/vehicles/${encodeURIComponent(vehicleId)}/tire-hotel-suppliers`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: HotelSupplier[] };
        if (cancelled) return;
        const items = data.items ?? [];
        setSuppliers(items);
        setSupplierId((prev) =>
          prev && items.some((s) => s.id === prev) ? prev : (items[0]?.id ?? ""),
        );
      } catch {
        if (!cancelled) setSuppliers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Selectează clientul");
      return;
    }
    if (!supplierId) {
      setError("Selectează partenerul (cu hotel anvelope)");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const plate = clientVehicles.find((v) => v.id === vehicleId)?.registrationNumber;
      const opLabel = TIRE_GESTIUNE_OPS.find((o) => o.code === gestiuneOp)?.label ?? "Gestiune";
      const subject = plate
        ? `${opLabel} anvelope — ${plate}`
        : `${opLabel} anvelope`;
      const res = await fetch(ticketsBrowserBase, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          clientId,
          vehicleId: vehicleId || undefined,
          subject,
          description: notes.trim() || undefined,
          gestiuneOp,
          assignedSupplierId: supplierId,
        }),
      });
      if (!res.ok) {
        let msg = `Eroare ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const saved = (await res.json()) as TicketRecord;
      router.push(`/fleet/tickets/${saved.id}`);
      router.refresh();
    } catch {
      setError("Nu am putut crea solicitarea");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Solicitare de gestiune</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Cazare, eliberare, transfer sau casare — ajunge în coada Anvelope a partenerului. Fără
          mișcare stoc încă.
        </p>
      </div>

      <label className="block text-xs text-zinc-400">
        Tip operație
        <select
          value={gestiuneOp}
          onChange={(e) => setGestiuneOp(e.target.value as TireGestiuneOp)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          {TIRE_GESTIUNE_OPS.map((op) => (
            <option key={op.code} value={op.code}>
              {op.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-1 text-xs text-zinc-400">Client</p>
        <ClientSelect
          value={clientId}
          onChange={(id) => {
            setClientId(id);
            setVehicleId("");
            setSupplierId("");
          }}
        />
      </div>

      <label className="block text-xs text-zinc-400">
        Vehicul
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">— opțional —</option>
          {clientVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-zinc-400">
        Partener alocat
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          required
          disabled={!vehicleId && suppliers.length === 0}
        >
          <option value="">
            {vehicleId ? "— alege partenerul —" : "— selectează mai întâi vehiculul —"}
          </option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.legalName}
            </option>
          ))}
        </select>
        {!vehicleId ? (
          <span className="mt-1 block text-[11px] text-zinc-500">
            Partenerii hotel sunt încărcați după alegerea vehiculului (alocare client).
          </span>
        ) : null}
      </label>

      <label className="block text-xs text-zinc-400">
        Note
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {pending ? "Se creează…" : "Trimite solicitarea"}
        </button>
        <Link
          href="/fleet/tickets"
          className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
