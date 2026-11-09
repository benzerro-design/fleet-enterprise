"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TireCustodyProtocolPanel } from "@/components/fleet/partner/TireCustodyProtocolPanel";
import { WarehouseLocationPicker } from "@/components/fleet/partner/WarehouseLocationPicker";
import {
  appendPartnerSupplierQuery,
  parsePartnerSupplierQuery,
  partnerSupplierSearchParams,
} from "@/lib/partner-context";
import { assignCustodyLocation } from "@/lib/partner-tire-custody-api";
import {
  listTireCustodyProtocols,
  openTireCustodyProtocol,
  type TireCustodyProtocolRecord,
} from "@/lib/tire-custody-api";
import { tireRequestStatusLabel } from "@/lib/tire-gestiune";

type CazareStatus = {
  item: {
    id: string;
    displayId?: string;
    subject: string;
    status: string;
    plate: string | null;
    clientName: string | null;
    supplierId?: string | null;
    supplierName?: string | null;
    stayIds?: string[];
  };
  capability: {
    hasTireStorage: boolean;
    supplierId: string;
    supplierName: string | null;
  };
  stay: {
    id: string;
    locationCode: string | null;
    warehouseLocationId: string | null;
    locationLabel: string | null;
    checkInAt: string;
  } | null;
  checkInProtocol: {
    id: string;
    status: string;
    hasArchivedPdf: boolean;
  } | null;
  progress: {
    hasStay: boolean;
    hasSignedPv: boolean;
    hasLocation: boolean;
    canComplete: boolean;
    complete: boolean;
  };
};

type Props = {
  ticketId: string;
  canWrite: boolean;
};

function Step({
  n,
  label,
  done,
  active,
}: {
  n: number;
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
        done
          ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-200"
          : active
            ? "border-sky-800/50 bg-sky-950/20 text-sky-100"
            : "border-zinc-800 text-zinc-500"
      }`}
    >
      <span className="font-mono">{done ? "✓" : n}</span>
      {label}
    </div>
  );
}

export function PartnerCazareExecuteClient({ ticketId, canWrite }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierQuery = useMemo(
    () => parsePartnerSupplierQuery(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );
  const qs = partnerSupplierSearchParams(supplierQuery).toString();
  const stayHint = (searchParams.get("stayId") ?? "").trim() || null;

  const [data, setData] = useState<CazareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<TireCustodyProtocolRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pickLocation, setPickLocation] = useState(false);

  const detailHref = appendPartnerSupplierQuery(
    `/fleet/partner/tire-requests/${ticketId}`,
    supplierQuery,
  );
  const listHref = appendPartnerSupplierQuery("/fleet/partner/tire-requests", supplierQuery);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/partner/tire-hotel/requests/${encodeURIComponent(ticketId)}/cazare?${qs}`,
        { cache: "no-store" },
      );
      const j = (await res.json().catch(() => ({}))) as CazareStatus & { message?: string };
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      setData(j);
      return j;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
      return null;
    } finally {
      setLoading(false);
    }
  }, [ticketId, qs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!data?.stay?.id || !data.capability.supplierId) return;
    let cancelled = false;
    void (async () => {
      try {
        const items = await listTireCustodyProtocols(
          data.stay!.id,
          data.capability.supplierId,
        );
        const checkIn =
          items.find((p) => p.kind === "check_in" && p.status === "signed") ??
          items.find((p) => p.kind === "check_in") ??
          null;
        if (!cancelled) setProtocol(checkIn);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.stay?.id, data?.capability.supplierId, data?.checkInProtocol?.id, data?.checkInProtocol?.status]);

  async function openPv() {
    if (!data?.stay?.id) return;
    setBusy("pv");
    setError(null);
    try {
      const p = await openTireCustodyProtocol(
        data.stay.id,
        "check_in",
        data.capability.supplierId,
      );
      setProtocol(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut deschide PV");
    } finally {
      setBusy(null);
    }
  }

  async function onAssignLocation(locationId: string, label: string) {
    if (!data?.stay?.id) return;
    setBusy("loc");
    setError(null);
    try {
      await assignCustodyLocation(data.stay.id, locationId, data.capability.supplierId);
      setPickLocation(false);
      await reload();
      void label;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Atribuire locație eșuată");
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    setBusy("complete");
    setError(null);
    try {
      const res = await fetch(
        `/api/partner/tire-hotel/requests/${encodeURIComponent(ticketId)}/complete-cazare?${qs}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplierId: data?.capability.supplierId }),
        },
      );
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      router.push(listHref);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalizare eșuată");
    } finally {
      setBusy(null);
    }
  }

  const checkInHref = useMemo(() => {
    const p = new URLSearchParams();
    if (data?.capability.supplierId) p.set("supplierId", data.capability.supplierId);
    p.set("ticketId", ticketId);
    if (data?.item.plate) p.set("plate", data.item.plate);
    return `/fleet/partner/tire-hotel/check-in?${p.toString()}`;
  }, [data?.capability.supplierId, data?.item.plate, ticketId]);

  if (loading && !data) {
    return <p className="text-sm text-zinc-500">Se încarcă fluxul de cazare…</p>;
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-300">{error ?? "Nu am putut încărca solicitarea"}</p>
        <Link href={detailHref} className="text-sm text-sky-400 hover:underline">
          ← Înapoi la fișă
        </Link>
      </div>
    );
  }

  const { progress, capability, item, stay } = data;
  const activeStep = !progress.hasStay
    ? 1
    : !progress.hasSignedPv
      ? 2
      : !progress.hasLocation
        ? 3
        : 4;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href={detailHref} className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Fișa solicitării
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-100">Execută cazarea</h1>
        <p className="mt-1 text-xs text-zinc-500">
          #{item.displayId ?? item.id.slice(-6).toUpperCase()} · {item.subject} ·{" "}
          {tireRequestStatusLabel(item.status)}
          {stayHint ? ` · stay ${stayHint.slice(0, 8)}…` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Step n={1} label="Check-in" done={progress.hasStay} active={activeStep === 1} />
        <Step n={2} label="PV semnat" done={progress.hasSignedPv} active={activeStep === 2} />
        <Step n={3} label="Locație raft" done={progress.hasLocation} active={activeStep === 3} />
        <Step n={4} label="Finalizează" done={progress.complete} active={activeStep === 4} />
      </div>

      {!capability.hasTireStorage ? (
        <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Furnizorul nu are activată capacitatea <code className="text-xs">tire_storage</code> —
          nu poate executa cazarea (depozitar hotel). Contactează adminul tenantului.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {/* Step 1 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">1. Check-in pe sejur</h2>
        {progress.hasStay && stay ? (
          <p className="mt-2 text-xs text-zinc-400">
            Sejur activ {stay.id.slice(0, 10)}… · check-in{" "}
            {new Date(stay.checkInAt).toLocaleString("ro-RO")}
            {stay.locationCode ? ` · bay ${stay.locationCode}` : ""}
          </p>
        ) : capability.hasTireStorage && canWrite ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-zinc-500">
              Cazează setul (placă {item.plate ?? "—"}) cu contextul acestei solicitări. După
              check-in revii aici pentru PV și locație.
            </p>
            <Link
              href={checkInHref}
              className="inline-flex rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600"
            >
              Deschide check-in
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Check-in indisponibil.</p>
        )}
      </section>

      {/* Step 2 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">2. PV recepție (gestionar + șofer/client)</h2>
        {!progress.hasStay ? (
          <p className="mt-2 text-xs text-zinc-500">Mai întâi check-in.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {progress.hasSignedPv ? (
              <p className="text-xs text-emerald-300">PV check-in semnat și arhivat.</p>
            ) : canWrite ? (
              <button
                type="button"
                disabled={busy === "pv"}
                onClick={() => void openPv()}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
              >
                {busy === "pv" ? "Se deschide…" : protocol ? "Reîncarcă PV" : "Deschide PV check-in"}
              </button>
            ) : null}
            {protocol ? (
              <TireCustodyProtocolPanel
                protocol={protocol}
                canWrite={canWrite}
                supplierId={capability.supplierId}
                onUpdated={(p) => {
                  setProtocol(p);
                  if (p.status === "signed") void reload();
                }}
                onClose={() => setProtocol(null)}
              />
            ) : null}
          </div>
        )}
      </section>

      {/* Step 3 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">3. Locație depozit</h2>
        {progress.hasLocation && stay?.locationLabel ? (
          <p className="mt-2 text-xs text-emerald-300">Locație: {stay.locationLabel}</p>
        ) : !progress.hasStay ? (
          <p className="mt-2 text-xs text-zinc-500">Mai întâi check-in.</p>
        ) : canWrite ? (
          <div className="mt-3 space-y-2">
            {!pickLocation ? (
              <button
                type="button"
                onClick={() => setPickLocation(true)}
                className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-100"
              >
                Atribuie locație (zonă → rând → locație)
              </button>
            ) : (
              <WarehouseLocationPicker
                supplierId={capability.supplierId}
                onPick={(id, label) => void onAssignLocation(id, label)}
                onCancel={() => setPickLocation(false)}
              />
            )}
            {busy === "loc" ? <p className="text-[11px] text-zinc-500">Se salvează…</p> : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Doar citire.</p>
        )}
      </section>

      {/* Step 4 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">4. Închide solicitarea</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Marchează cazarea ca finalizată (resolved) — dispare din coada Anvelope.
        </p>
        {canWrite ? (
          <button
            type="button"
            disabled={!progress.canComplete || busy === "complete"}
            onClick={() => void complete()}
            className="mt-3 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-40"
          >
            {busy === "complete" ? "Se finalizează…" : "Finalizează cazarea"}
          </button>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={listHref} className="text-zinc-500 hover:text-zinc-300">
          ← Coadă Anvelope
        </Link>
        <Link
          href={appendPartnerSupplierQuery("/fleet/partner/custody-stock", supplierQuery)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          Stoc în custodie
        </Link>
      </div>
    </div>
  );
}
