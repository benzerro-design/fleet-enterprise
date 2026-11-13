"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  custodyKindLabel,
  issueDriverVehicleCustodySignLink,
  listDriverVehicleCustodyPending,
  type DriverVehicleCustodyPending,
} from "@/lib/driver-tire-custody-api";

type Props = {
  vehicleId: string;
};

export function VehicleDriverTireCustodyPanel({ vehicleId }: Props) {
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

  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-emerald-100">Protocoale custodie anvelope</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Acțiune necesară: hotelul a pregătit un PV pentru seturile acestui vehicul. Deschide
          documentul, verifică datele și semnează numai dacă ești de acord.
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.protocolId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
          >
            <div className="min-w-0 text-xs">
              <p className="font-medium text-zinc-100">{custodyKindLabel(item.kind)}</p>
              <p className="mt-0.5 text-zinc-500">
                {[item.supplierName, item.locationText].filter(Boolean).join(" · ") || "Hotel anvelope"}
              </p>
              {item.hasDriverInvite && item.driverInviteExpiresAt ? (
                <p className="mt-0.5 text-[10px] text-emerald-200/80">
                  Cod de semnare deja emis (nu este încă semnat) · valabil până la{" "}
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
      {actionError ? <p className="text-xs text-rose-400">{actionError}</p> : null}
      {signLink ? (
        <div className="rounded-lg border border-emerald-800/50 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300 space-y-2">
          <p className="text-zinc-300">
            Cod unic pentru această invitație. Îl introduci pe pagina următoare; expiră automat și
            nu poate fi refolosit după semnare.
          </p>
          <p>
            OTP: <span className="font-mono text-base tracking-widest text-emerald-100">{signLink.otp}</span>
          </p>
          <p className="text-[11px] text-zinc-500">
            Expiră {new Date(signLink.expiresAt).toLocaleString("ro-RO")}
          </p>
          <Link
            href={signLink.url}
            className="inline-block rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-medium text-white hover:bg-emerald-600"
          >
            Continuă spre semnătură →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
