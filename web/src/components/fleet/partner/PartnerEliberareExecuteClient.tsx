"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TireCustodyProtocolPanel } from "@/components/fleet/partner/TireCustodyProtocolPanel";
import {
  appendPartnerSupplierQuery,
  parsePartnerSupplierQuery,
  partnerSupplierSearchParams,
} from "@/lib/partner-context";
import {
  listTireCustodyProtocols,
  openTireCustodyProtocol,
  type TireCustodyProtocolRecord,
} from "@/lib/tire-custody-api";
import { tireRequestStatusLabel } from "@/lib/tire-gestiune";
import { tireMountedAsLabel } from "@/lib/vehicle-wheels-types";

type EliberareStatus = {
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
    checkOutAt: string | null;
    mountedAs: string | null;
    plate: string | null;
  } | null;
  checkInProtocol: {
    id: string;
    status: string;
    hasArchivedPdf: boolean;
  } | null;
  releaseProtocol: {
    id: string;
    kind: string;
    status: string;
    hasArchivedPdf: boolean;
  } | null;
  progress: {
    hasOpenStay: boolean;
    hasSignedCheckInPv: boolean;
    hasSignedReleasePv: boolean;
    stayCheckedOut: boolean;
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

export function PartnerEliberareExecuteClient({ ticketId, canWrite }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierQuery = useMemo(
    () => parsePartnerSupplierQuery(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );
  const qs = partnerSupplierSearchParams(supplierQuery).toString();

  const [data, setData] = useState<EliberareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releaseProtocol, setReleaseProtocol] = useState<TireCustodyProtocolRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
        `/api/partner/tire-hotel/requests/${encodeURIComponent(ticketId)}/eliberare?${qs}`,
        { cache: "no-store" },
      );
      const j = (await res.json().catch(() => ({}))) as EliberareStatus & { message?: string };
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
        const items = await listTireCustodyProtocols(data.stay!.id, data.capability.supplierId);
        const releaseKinds = ["check_out", "scrap", "transfer", "leasing_return", "quarantine"] as const;
        const signed =
          items.find(
            (p) => releaseKinds.includes(p.kind as (typeof releaseKinds)[number]) && p.status === "signed",
          ) ??
          items.find((p) => releaseKinds.includes(p.kind as (typeof releaseKinds)[number])) ??
          null;
        if (!cancelled) setReleaseProtocol(signed);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.stay?.id, data?.capability.supplierId, data?.releaseProtocol?.id]);

  async function openReleasePv() {
    if (!data?.stay?.id) return;
    setBusy("pv");
    setError(null);
    try {
      const p = await openTireCustodyProtocol(
        data.stay.id,
        "check_out",
        data.capability.supplierId,
      );
      setReleaseProtocol(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut deschide PV");
    } finally {
      setBusy(null);
    }
  }

  async function performCheckOut() {
    if (!data?.stay?.id) return;
    setBusy("checkout");
    setError(null);
    try {
      const res = await fetch("/api/partner/tire-hotel/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: data.capability.supplierId,
          stayId: data.stay.id,
          ticketId,
          releaseKind: "at_client",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Check-out eșuat");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eliberare eșuată");
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    setBusy("complete");
    setError(null);
    try {
      const res = await fetch(
        `/api/partner/tire-hotel/requests/${encodeURIComponent(ticketId)}/complete-eliberare?${qs}`,
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

  if (loading && !data) {
    return <p className="text-sm text-zinc-500">Se încarcă fluxul de eliberare…</p>;
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
  const hasStay = Boolean(stay);
  const mountedAsLabel =
    stay?.mountedAs === "on_rim" || stay?.mountedAs === "tyre_only"
      ? tireMountedAsLabel(stay.mountedAs)
      : null;

  const activeStep = !hasStay
    ? 1
    : !progress.hasSignedCheckInPv
      ? 2
      : !progress.hasSignedReleasePv
        ? 3
        : !progress.stayCheckedOut
          ? 4
          : 5;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href={detailHref} className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Fișa solicitării
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-100">Execută eliberarea</h1>
        <p className="mt-1 text-xs text-zinc-500">
          #{item.displayId ?? item.id.slice(-6).toUpperCase()} · {item.subject} ·{" "}
          {tireRequestStatusLabel(item.status)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Step n={1} label="Sejur" done={hasStay} active={activeStep === 1} />
        <Step n={2} label="PV check-in" done={progress.hasSignedCheckInPv} active={activeStep === 2} />
        <Step
          n={3}
          label="PV eliberare"
          done={progress.hasSignedReleasePv}
          active={activeStep === 3}
        />
        <Step n={4} label="Check-out" done={progress.stayCheckedOut} active={activeStep === 4} />
        <Step n={5} label="Finalizează" done={progress.complete} active={activeStep === 5} />
      </div>

      {!capability.hasTireStorage ? (
        <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Furnizorul nu are activată capacitatea <code className="text-xs">tire_storage</code>.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">1. Sejur în hotel</h2>
        {hasStay && stay ? (
          <div className="mt-2 space-y-1 text-xs text-zinc-400">
            <p>
              Sejur {stay.id.slice(0, 10)}… · {stay.plate ?? item.plate ?? "—"} · check-in{" "}
              {new Date(stay.checkInAt).toLocaleString("ro-RO")}
            </p>
            {stay.locationLabel ? <p>Locație: {stay.locationLabel}</p> : null}
            {mountedAsLabel ? (
              <span className="inline-flex rounded-md border border-violet-800/40 bg-violet-950/30 px-2 py-0.5 text-[11px] text-violet-100">
                Tip set: {mountedAsLabel}
              </span>
            ) : null}
            {progress.hasOpenStay ? (
              <p className="text-emerald-300/90">Sejur deschis — gata de eliberare.</p>
            ) : progress.stayCheckedOut ? (
              <p className="text-emerald-300/90">Sejur închis (check-out efectuat).</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-200/90">
            Nu am găsit un sejur deschis pentru {item.plate ?? "vehiculul solicitării"} la acest
            furnizor. Verifică inventarul hotel sau creează o solicitare cu nr. înmatriculare corect.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">2. PV check-in arhivat</h2>
        {progress.hasSignedCheckInPv ? (
          <p className="mt-2 text-xs text-emerald-300">PV recepție semnat și arhivat.</p>
        ) : (
          <p className="mt-2 text-xs text-amber-200/90">
            E necesar PV check-in semnat înainte de eliberare. Finalizează PV-ul din inventar hotel
            sau din stoc custodie.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">3. PV eliberare (check-out)</h2>
        {!hasStay ? (
          <p className="mt-2 text-xs text-zinc-500">Mai întâi identifică sejurul.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {progress.hasSignedReleasePv ? (
              <p className="text-xs text-emerald-300">
                PV eliberare semnat ({data.releaseProtocol?.kind ?? "check_out"}).
              </p>
            ) : canWrite ? (
              <button
                type="button"
                disabled={busy === "pv"}
                onClick={() => void openReleasePv()}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
              >
                {busy === "pv" ? "Se deschide…" : releaseProtocol ? "Reîncarcă PV" : "Deschide PV check-out"}
              </button>
            ) : null}
            {releaseProtocol ? (
              <TireCustodyProtocolPanel
                protocol={releaseProtocol}
                canWrite={canWrite}
                supplierId={capability.supplierId}
                onUpdated={(p) => {
                  setReleaseProtocol(p);
                  if (p.status === "signed") void reload();
                }}
                onClose={() => setReleaseProtocol(null)}
              />
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">4. Eliberează din stoc</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Închide sejurul și mută anvelopele la client (după PV semnat).
        </p>
        {progress.stayCheckedOut ? (
          <p className="mt-2 text-xs text-emerald-300">Check-out deja efectuat.</p>
        ) : canWrite && hasStay && progress.hasSignedReleasePv ? (
          <button
            type="button"
            disabled={busy === "checkout"}
            onClick={() => void performCheckOut()}
            className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-40"
          >
            {busy === "checkout" ? "Se eliberează…" : "Confirmă eliberarea (check-out)"}
          </button>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            {!progress.hasSignedReleasePv
              ? "Finalizează PV eliberare mai întâi."
              : "Check-out indisponibil."}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">5. Închide solicitarea</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Marchează eliberarea ca finalizată (resolved) — dispare din coada Anvelope.
        </p>
        {canWrite ? (
          <button
            type="button"
            disabled={!progress.canComplete || busy === "complete"}
            onClick={() => void complete()}
            className="mt-3 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-40"
          >
            {busy === "complete" ? "Se finalizează…" : "Finalizează eliberarea"}
          </button>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={listHref} className="text-zinc-500 hover:text-zinc-300">
          ← Coadă Anvelope
        </Link>
        <Link
          href={appendPartnerSupplierQuery("/fleet/partner/tire-hotel", supplierQuery)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          Inventar hotel
        </Link>
      </div>
    </div>
  );
}
