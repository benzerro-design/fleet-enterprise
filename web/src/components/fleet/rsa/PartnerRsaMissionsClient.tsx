"use client";

import { useCallback, useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { RsaDropoffQr } from "@/components/fleet/rsa/RsaDropoffQr";
import { RsaHandoverPanel } from "@/components/fleet/rsa/RsaHandoverPanel";
import { RsaOfflineBanner } from "@/components/fleet/rsa/RsaOfflineBanner";
import { enqueueRsaOfflineOp } from "@/lib/rsa-offline-queue";
import {
  loadRsaMission,
  loadRsaMissions,
  loadRsaProtocol,
  openRsaProtocol,
  patchRsaMission,
  previewRsaSettlement,
  rsaHandoverKindLabel,
  rsaMissionStatusLabel,
  settleRsaMission,
  type RsaHandoverKind,
  type RsaMissionRecord,
  type RsaMissionStatus,
  type RsaProtocolRecord,
  type RsaSettlementBreakdown,
} from "@/lib/roadside-api";

const NEXT: Partial<Record<RsaMissionStatus, RsaMissionStatus>> = {
  assigned: "en_route",
  en_route: "on_scene",
  on_scene: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
  delivered: "closed",
};

export function PartnerRsaMissionsClient({ canWrite }: { canWrite: boolean }) {
  const [items, setItems] = useState<RsaMissionRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mission, setMission] = useState<RsaMissionRecord | null>(null);
  const [protocol, setProtocol] = useState<RsaProtocolRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [distanceKm, setDistanceKm] = useState("");
  const [preview, setPreview] = useState<RsaSettlementBreakdown | null>(null);
  const [applyNightWeekend, setApplyNightWeekend] = useState(false);
  const [applyWinch, setApplyWinch] = useState(false);

  const refreshList = useCallback(async () => {
    try {
      const data = await loadRsaMissions({ pageSize: 50 });
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare listă misiuni");
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    setProtocol(null);
    if (!activeId) {
      setMission(null);
      return;
    }
    let cancelled = false;
    void loadRsaMission(activeId)
      .then((m) => {
        if (cancelled) return;
        setMission(m);
        setDistanceKm(m.distanceKm != null ? String(m.distanceKm) : "");
        setPreview(m.settlementBreakdown);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Eroare misiune");
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  async function onSettle() {
    if (!mission || !canWrite) return;
    const n = Number(distanceKm.trim());
    if (!Number.isFinite(n) || n < 0 || Math.round(n) !== n) {
      setError("Km tractați: întreg ≥ 0");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const r = await settleRsaMission(mission.id, {
        distanceKm: n,
        applyNightWeekend,
        applyWinch,
      });
      setMission(r.mission);
      setPreview(r.breakdown);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settlement eșuat");
    } finally {
      setPending(false);
    }
  }

  async function onPreview() {
    if (!mission) return;
    const n = Number(distanceKm.trim());
    if (!Number.isFinite(n) || n < 0 || Math.round(n) !== n) {
      setError("Km tractați: întreg ≥ 0");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const p = await previewRsaSettlement(mission.id, {
        distanceKm: n,
        applyNightWeekend,
        applyWinch,
      });
      setPreview(p.breakdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview eșuat");
    } finally {
      setPending(false);
    }
  }

  async function advance() {
    if (!mission || !canWrite) return;
    const next = NEXT[mission.status];
    if (!next) return;
    setPending(true);
    setError(null);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueRsaOfflineOp({
          type: "patch_mission",
          missionId: mission.id,
          payload: { status: next },
        });
        setMission({ ...mission, status: next });
        return;
      }
      const m = await patchRsaMission(mission.id, { status: next });
      setMission(m);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tranziție eșuată");
    } finally {
      setPending(false);
    }
  }

  async function cancelMission() {
    if (!mission || !canWrite) return;
    const reason = window.prompt("Motiv anulare misiune (opțional):") ?? "";
    setPending(true);
    setError(null);
    try {
      const body = {
        status: "cancelled" as const,
        cancelReason: reason.trim() || "Anulat din portal partner",
      };
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueRsaOfflineOp({
          type: "patch_mission",
          missionId: mission.id,
          payload: body,
        });
        setMission({ ...mission, status: "cancelled" });
        setProtocol(null);
        return;
      }
      const m = await patchRsaMission(mission.id, body);
      setMission(m);
      setProtocol(null);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anulare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function openKind(kind: RsaHandoverKind) {
    if (!mission || !canWrite) return;
    setPending(true);
    setError(null);
    try {
      const p = await openRsaProtocol(mission.id, kind);
      setProtocol(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PV eșuat");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-3 py-4 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-2">
        <h1 className="text-lg font-medium text-zinc-100">Misiuni asistență</h1>
        <p className="text-xs text-zinc-500">
          Coadă teren — preluare / predare cu semnătură pe ecran.
        </p>
        <RsaOfflineBanner />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {items.length === 0 ? (
            <li className="px-3 py-4 text-sm text-zinc-500">Nicio misiune.</li>
          ) : (
            items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(m.id)}
                  className={`w-full px-3 py-3 text-left text-sm ${
                    activeId === m.id ? "bg-zinc-900 text-emerald-300" : "text-zinc-200"
                  }`}
                >
                  <div className="font-mono text-xs text-zinc-500">
                    {m.interventionDisplayNumber ?? m.id.slice(0, 8)}
                  </div>
                  <div>{m.vehicleReg ?? "—"} · {rsaMissionStatusLabel(m.status)}</div>
                  <div className="text-xs text-zinc-500">{m.clientLegalName}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="min-w-0 space-y-4">
        {!mission ? (
          <p className="text-sm text-zinc-500">Selectați o misiune din listă.</p>
        ) : (
          <>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-base text-zinc-100">
                {mLabel(mission)} · {rsaMissionStatusLabel(mission.status)}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {mission.pickupLocationText ?? "—"} → {mission.dropoffLocationText ?? "—"}
              </p>
              <div className="mt-3">
                <RsaDropoffQr
                  missionId={mission.id}
                  dropoffLocationText={mission.dropoffLocationText}
                  vehicleReg={mission.vehicleReg}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {canWrite && NEXT[mission.status] ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void advance()}
                    className="rounded-lg bg-violet-700 px-4 py-3 text-sm text-white disabled:opacity-50"
                  >
                    Avansare status
                  </button>
                ) : null}
                {canWrite &&
                mission.status !== "delivered" &&
                mission.status !== "closed" &&
                mission.status !== "cancelled" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void cancelMission()}
                    className="rounded-lg border border-rose-800/60 px-4 py-3 text-sm text-rose-300 disabled:opacity-50"
                  >
                    Anulează misiunea
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["pickup", "dropoff"] as RsaHandoverKind[]).map((kind) => {
                  const existing = mission.protocols.find((p) => p.kind === kind);
                  return (
                    <button
                      key={kind}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (existing && !canWrite && existing.status === "signed") {
                          void loadRsaProtocol(existing.id).then(setProtocol);
                          return;
                        }
                        if (canWrite) void openKind(kind);
                        else if (existing) void loadRsaProtocol(existing.id).then(setProtocol);
                      }}
                      className="rounded-lg border border-zinc-600 px-4 py-3 text-sm text-zinc-100"
                    >
                      {rsaHandoverKindLabel(kind)}
                      {existing ? ` · ${existing.status}` : ""}
                    </button>
                  );
                })}
              </div>
              {(mission.status === "delivered" ||
                mission.status === "closed" ||
                mission.settlementCostEntryId) &&
              mission.protocols.some((p) => p.kind === "dropoff" && p.status === "signed") ? (
                <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
                  <p className="text-sm text-zinc-200">Decont RSA</p>
                  {mission.settlementCostEntryId ? (
                    <p className="text-sm text-emerald-400">
                      Decontat {((mission.settlementAmountCents ?? 0) / 100).toFixed(2)} RON
                      {mission.distanceKm != null ? ` · ${mission.distanceKm} km` : ""}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block">
                        <span className={OPS_LABEL_CLASS}>Km</span>
                        <input
                          className={OPS_INPUT_CLASS}
                          value={distanceKm}
                          disabled={pending || !canWrite}
                          onChange={(e) => setDistanceKm(e.target.value)}
                        />
                      </label>
                      <label className="flex items-center gap-2 pb-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={applyNightWeekend}
                          disabled={pending || !canWrite}
                          onChange={(e) => setApplyNightWeekend(e.target.checked)}
                        />
                        Noapte/weekend
                      </label>
                      <label className="flex items-center gap-2 pb-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={applyWinch}
                          disabled={pending || !canWrite}
                          onChange={(e) => setApplyWinch(e.target.checked)}
                        />
                        Troliu
                      </label>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void onPreview()}
                        className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-200"
                      >
                        Preview
                      </button>
                      {canWrite ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void onSettle()}
                          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
                        >
                          Generează CostEntry
                        </button>
                      ) : null}
                    </div>
                  )}
                  {preview ? (
                    <p className="text-xs text-zinc-500">
                      {preview.mode} · {preview.entitlementStatus} ·{" "}
                      {(preview.amountCents / 100).toFixed(2)} RON
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {protocol ? (
              <RsaHandoverPanel
                key={protocol.id}
                protocol={protocol}
                canWrite={canWrite && protocol.status === "draft"}
                onUpdated={(p) => {
                  setProtocol(p);
                  void loadRsaMission(mission.id).then(setMission);
                  void refreshList();
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function mLabel(m: RsaMissionRecord): string {
  return [m.vehicleReg, m.driverDisplayName, m.platformPlate].filter(Boolean).join(" · ") || m.id;
}
