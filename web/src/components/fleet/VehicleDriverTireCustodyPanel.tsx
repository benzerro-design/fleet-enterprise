"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PilotHint } from "@/components/fleet/PilotHint";
import {
  custodyKindLabel,
  driverCustodyPhaseLabel,
  issueDriverVehicleCustodySignLink,
  listDriverVehicleCustodyPending,
  type DriverVehicleCustodyPending,
} from "@/lib/driver-tire-custody-api";

type Props = {
  vehicleId: string;
  /** When true, always render a status card (even with no pending items). */
  alwaysShow?: boolean;
};

function currentAppReturnPath(): string {
  if (typeof window === "undefined") return "/fleet/vehicles";
  return `${window.location.pathname}${window.location.search}` || "/fleet/vehicles";
}

function phaseTone(phase: DriverVehicleCustodyPending["phase"]): string {
  if (phase === "needs_driver_sign") return "border-emerald-900/40 bg-emerald-950/20";
  if (phase === "awaiting_partner_finalize") return "border-sky-900/40 bg-sky-950/20";
  return "border-zinc-800 bg-zinc-950/40";
}

export function VehicleDriverTireCustodyPanel({ vehicleId, alwaysShow = false }: Props) {
  const [items, setItems] = useState<DriverVehicleCustodyPending[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [signLink, setSignLink] = useState<{
    protocolId: string;
    url: string;
    otp: string;
    expiresAt: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listDriverVehicleCustodyPending(vehicleId);
        if (!cancelled) {
          setItems(next);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setLoadError(e instanceof Error ? e.message : "Nu am putut încărca protocoalele");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const actionable = useMemo(
    () => items.filter((i) => i.phase === "needs_driver_sign"),
    [items],
  );
  const waiting = useMemo(
    () => items.filter((i) => i.phase === "awaiting_partner_finalize"),
    [items],
  );
  const done = useMemo(() => items.filter((i) => i.phase === "done"), [items]);
  const headline = actionable[0] ?? waiting[0] ?? done[0] ?? null;

  async function openSign(protocolId: string) {
    setPendingId(protocolId);
    setActionError(null);
    try {
      const res = await issueDriverVehicleCustodySignLink(vehicleId, protocolId);
      let href = res.url;
      try {
        href = new URL(res.url).pathname;
      } catch {
        if (!href.startsWith("/")) href = `/${href}`;
      }
      setSignLink({
        protocolId,
        url: href,
        otp: res.otp,
        expiresAt: res.expiresAt,
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Link semnare eșuat");
    } finally {
      setPendingId(null);
    }
  }

  if (loadError) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
        Protocoale custodie: {loadError}
      </p>
    );
  }

  if (!headline && !alwaysShow) return null;

  return (
    <section className={`rounded-xl border p-4 space-y-3 ${phaseTone(headline?.phase ?? "done")}`}>
      <div>
        <h3 className="text-sm font-medium text-zinc-100">
          {headline ? driverCustodyPhaseLabel(headline.phase) : "Custodie anvelope"}
        </h3>
        {headline?.phase === "needs_driver_sign" ? (
          <p className="mt-1 text-xs text-zinc-300">
            Hotelul a pregătit {custodyKindLabel(headline.kind)}. Verifică datele și semnează doar
            dacă ești de acord.
          </p>
        ) : null}
        {headline?.phase === "awaiting_partner_finalize" ? (
          <p className="mt-1 text-xs text-zinc-300">
            Semnătura ta e înregistrată
            {headline.driverSignedAt
              ? ` (${new Date(headline.driverSignedAt).toLocaleString("ro-RO")})`
              : ""}
            . Urmează: partenerul finalizează PV-ul și scoate setul din custodie. Poți închide
            pagina — te anunțăm în tichet când predarea e gata.
          </p>
        ) : null}
        {headline?.phase === "done" ? (
          <p className="mt-1 text-xs text-zinc-300">
            Predarea e finalizată
            {headline.stayCheckedOut ? " — setul a ieșit din inventarul hotel." : "."}
          </p>
        ) : null}
        {!headline ? (
          <p className="mt-1 text-xs text-zinc-500">Nicio acțiune de custodie în curs pe acest vehicul.</p>
        ) : null}
      </div>

      {headline ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
          <p className="font-medium text-zinc-200">{custodyKindLabel(headline.kind)}</p>
          <p className="mt-0.5">
            {[headline.supplierName, headline.locationText].filter(Boolean).join(" · ") ||
              "Hotel anvelope"}
          </p>
        </div>
      ) : null}

      {actionable.length > 0 ? (
        <ul className="space-y-2">
          {actionable.map((item) => (
            <li
              key={item.protocolId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
            >
              <div className="min-w-0 text-xs">
                <p className="font-medium text-zinc-100">{custodyKindLabel(item.kind)}</p>
                {item.hasDriverInvite && item.driverInviteExpiresAt ? (
                  <p className="mt-0.5 text-[10px] text-emerald-200/80">
                    Cod emis · valabil până la{" "}
                    {new Date(item.driverInviteExpiresAt).toLocaleString("ro-RO")}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pendingId === item.protocolId}
                onClick={() => void openSign(item.protocolId)}
                className="shrink-0 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-950/60 disabled:opacity-50"
              >
                {pendingId === item.protocolId
                  ? "Se pregătește…"
                  : item.hasDriverInvite
                    ? "Generează cod nou"
                    : "Pregătește semnarea"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {actionError ? <p className="text-xs text-rose-400">{actionError}</p> : null}
      {signLink ? (
        <div className="rounded-lg border border-emerald-800/50 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300 space-y-2">
          <PilotHint>
            Cod unic pentru această invitație. Îl introduci pe pagina următoare; expiră automat și
            nu poate fi refolosit după semnare.
          </PilotHint>
          <p>
            OTP:{" "}
            <span className="font-mono text-base tracking-widest text-emerald-100">{signLink.otp}</span>
          </p>
          <p className="text-[11px] text-zinc-500">
            Expiră {new Date(signLink.expiresAt).toLocaleString("ro-RO")}
          </p>
          <Link
            href={`${signLink.url}${signLink.url.includes("?") ? "&" : "?"}return=${encodeURIComponent(currentAppReturnPath())}`}
            className="inline-block rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-medium text-white hover:bg-emerald-600"
          >
            Continuă spre semnătură →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
