"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appendPartnerSupplierQuery,
  partnerSupplierSearchParams,
  type PartnerSupplierQuery,
} from "@/lib/partner-context";
import {
  TIRE_GESTIUNE_OPS,
  tireRequestKindLabel,
  tireRequestStatusLabel,
  type TireGestiuneOp,
} from "@/lib/tire-gestiune";

export type TireRequestItem = {
  id: string;
  displayId?: string;
  subject: string;
  status: string;
  kind: string;
  kindLabel?: string;
  serviceLabel: string | null;
  plate: string | null;
  clientName: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  createdAt: string;
  hrefTicket: string;
};

type ClientMeta = {
  id: string;
  legalName: string;
  code: string;
  supplierId: string;
  supplierName: string;
  vehicles: Array<{ id: string; plate: string }>;
};

type Props = {
  initialItems: TireRequestItem[];
  supplierQuery: PartnerSupplierQuery;
  canCreate: boolean;
  showSupplierColumn: boolean;
};

export function PartnerTireRequestsClient({
  initialItems,
  supplierQuery,
  canCreate,
  showSupplierColumn,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState<ClientMeta[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gestiuneOp, setGestiuneOp] = useState<TireGestiuneOp>("cazare");
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [notes, setNotes] = useState("");
  const [walkIn, setWalkIn] = useState(false);

  const qs = partnerSupplierSearchParams(supplierQuery).toString();

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const res = await fetch(`/api/partner/tire-hotel/requests/meta?${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { clients?: ClientMeta[] };
      setClients(data.clients ?? []);
    } finally {
      setMetaLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (showForm && clients.length === 0 && !metaLoading) {
      void loadMeta();
    }
  }, [showForm, clients.length, metaLoading, loadMeta]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Selectează clientul");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supplierId =
        selectedClient?.supplierId ||
        supplierQuery.supplierId ||
        supplierQuery.suppliers?.[0];
      const res = await fetch("/api/partner/tire-hotel/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gestiuneOp,
          clientId,
          vehicleId: vehicleId || undefined,
          notes: notes.trim() || undefined,
          walkIn,
          supplierId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: TireRequestItem;
        message?: string;
      };
      if (!res.ok) {
        setError(data.message ?? `Eroare ${res.status}`);
        return;
      }
      if (data.item) {
        setItems((prev) => [data.item!, ...prev]);
        setShowForm(false);
        setNotes("");
        setWalkIn(false);
        router.refresh();
        router.push(
          appendPartnerSupplierQuery(
            `/fleet/partner/tire-requests/${data.item.id}`,
            supplierQuery,
          ),
        );
      }
    } catch {
      setError("Nu am putut crea solicitarea");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Solicitări anvelope</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Coadă gestiune (cazare, eliberare, transfer, casare) și service. Execuția pe stoc vine
            în pachetele următoare.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
          >
            {showForm ? "Închide formular" : "Solicitare nouă"}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
        >
          <p className="text-xs font-medium text-zinc-300">Solicitare de gestiune</p>
          {metaLoading ? (
            <p className="text-xs text-zinc-500">Se încarcă clienții…</p>
          ) : clients.length === 0 ? (
            <p className="text-xs text-amber-200/90">
              Niciun client alocat pe acest furnizor. Alocă clientul din Setup, apoi reîncearcă.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-zinc-400">
                  Tip operație
                  <select
                    value={gestiuneOp}
                    onChange={(e) => setGestiuneOp(e.target.value as TireGestiuneOp)}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                  >
                    {TIRE_GESTIUNE_OPS.map((op) => (
                      <option key={op.code} value={op.code}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-zinc-400">
                  Client
                  <select
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      setVehicleId("");
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    required
                  >
                    <option value="">— alege —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.legalName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-zinc-400 sm:col-span-2">
                  Vehicul (opțional)
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                    disabled={!selectedClient}
                  >
                    <option value="">— fără vehicul —</option>
                    {(selectedClient?.vehicles ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-zinc-400 sm:col-span-2">
                  Note
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={walkIn}
                  onChange={(e) => setWalkIn(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                Client neanunțat (walk-in) — de confirmat la PV ulterior
              </label>
              {error ? <p className="text-xs text-red-300">{error}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {pending ? "Se creează…" : "Creează solicitarea"}
              </button>
            </>
          )}
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-500">
          Nicio solicitare deschisă.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => {
            const detailHref = appendPartnerSupplierQuery(
              `/fleet/partner/tire-requests/${it.id}`,
              supplierQuery,
            );
            return (
              <li
                key={it.id}
                className="flex flex-col gap-1.5 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-100">
                    <span className="mr-2 font-mono text-[10px] text-zinc-500">
                      #{it.displayId ?? it.id.slice(-6).toUpperCase()}
                    </span>
                    {it.subject}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {it.plate ?? "—"} · {it.clientName ?? "—"} ·{" "}
                    {it.kindLabel ?? tireRequestKindLabel(it.kind, it.serviceLabel)} ·{" "}
                    {tireRequestStatusLabel(it.status)}
                    {showSupplierColumn && it.supplierName ? ` · ${it.supplierName}` : ""}
                  </p>
                </div>
                <Link
                  href={detailHref}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-900"
                >
                  Deschide
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
