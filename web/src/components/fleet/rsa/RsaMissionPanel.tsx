"use client";

import { useCallback, useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { RsaDropoffQr } from "@/components/fleet/rsa/RsaDropoffQr";
import { RsaHandoverPanel } from "@/components/fleet/rsa/RsaHandoverPanel";
import { RsaOfflineBanner } from "@/components/fleet/rsa/RsaOfflineBanner";
import { enqueueRsaOfflineOp } from "@/lib/rsa-offline-queue";
import {
  createRsaMission,
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

function formatRon(cents: number): string {
  return `${(cents / 100).toFixed(2)} RON`;
}

const NEXT: Partial<Record<RsaMissionStatus, RsaMissionStatus>> = {
  assigned: "en_route",
  en_route: "on_scene",
  on_scene: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
  delivered: "closed",
};

const NEXT_LABEL: Partial<Record<RsaMissionStatus, string>> = {
  assigned: "Pleacă spre client",
  en_route: "Ajuns la fața locului",
  on_scene: "Confirmă preluare (după PV)",
  picked_up: "În tranzit",
  in_transit: "Confirmă predare (după PV)",
  delivered: "Închide misiunea",
};

type Props = {
  interventionId: string;
  canWrite: boolean;
  /** Intervenția trebuie să aibă furnizor RSA. */
  hasSupplier: boolean;
};

export function RsaMissionPanel({ interventionId, canWrite, hasSupplier }: Props) {
  const [mission, setMission] = useState<RsaMissionRecord | null>(null);
  const [protocol, setProtocol] = useState<RsaProtocolRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [plate, setPlate] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [preview, setPreview] = useState<RsaSettlementBreakdown | null>(null);
  const [applyNightWeekend, setApplyNightWeekend] = useState(false);
  const [applyWinch, setApplyWinch] = useState(false);

  const refresh = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const data = await loadRsaMissions({ interventionId, pageSize: 5 });
      const m = data.items[0] ?? null;
      setMission(m);
      if (m?.distanceKm != null) setDistanceKm(String(m.distanceKm));
      if (m?.settlementBreakdown) setPreview(m.settlementBreakdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare misiune");
      setMission(null);
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  }, [interventionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    if (!canWrite || !hasSupplier) return;
    setPending(true);
    setError(null);
    try {
      const m = await createRsaMission({
        interventionId,
        driverDisplayName: driverName || null,
        platformPlate: plate || null,
        dropoffLocationText: dropoff || null,
      });
      setMission(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creare misiune eșuată");
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
        setError(null);
        return;
      }
      const m = await patchRsaMission(mission.id, { status: next });
      setMission(m);
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
        cancelReason: reason.trim() || "Anulat din UI",
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
      await refresh({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deschidere PV eșuată");
    } finally {
      setPending(false);
    }
  }

  async function openExisting(protocolId: string) {
    setPending(true);
    setError(null);
    try {
      setProtocol(await loadRsaProtocol(protocolId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare PV eșuată");
    } finally {
      setPending(false);
    }
  }

  function parsedKm(): number | null {
    const t = distanceKm.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || Math.round(n) !== n) return null;
    return n;
  }

  async function onPreviewSettle() {
    if (!mission) return;
    const km = parsedKm();
    if (km == null) {
      setError("Introduceți km tractați (întreg ≥ 0)");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (canWrite && mission.distanceKm !== km && !mission.settlementCostEntryId) {
        await patchRsaMission(mission.id, { distanceKm: km });
      }
      const p = await previewRsaSettlement(mission.id, {
        distanceKm: km,
        applyNightWeekend,
        applyWinch,
      });
      setPreview(p.breakdown);
      await refresh({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview decont eșuat");
    } finally {
      setPending(false);
    }
  }

  async function onSettle() {
    if (!mission || !canWrite) return;
    const km = parsedKm();
    if (km == null) {
      setError("Introduceți km tractați (întreg ≥ 0)");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const r = await settleRsaMission(mission.id, {
        distanceKm: km,
        applyNightWeekend,
        applyWinch,
      });
      setMission(r.mission);
      setPreview(r.breakdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settlement eșuat");
    } finally {
      setPending(false);
    }
  }

  const canSettleUi =
    !!mission &&
    (mission.status === "delivered" || mission.status === "closed") &&
    mission.protocols.some((p) => p.kind === "dropoff" && p.status === "signed");

  if (loading) {
    return <p className="text-sm text-zinc-500">Se încarcă misiunea teren…</p>;
  }

  return (
    <div className="space-y-4 border-t border-zinc-800 pt-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-100">Misiune teren / custodie</h4>
        <p className="mt-1 text-xs text-zinc-500">
          Șoferul platformă: preluare de la client → PV semnat pe ecran → transport → predare +
          PV.
        </p>
      </div>

      <RsaOfflineBanner />

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {!mission ? (
        canWrite && hasSupplier ? (
          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Șofer (nume)</span>
                <input
                  className={OPS_INPUT_CLASS}
                  value={driverName}
                  disabled={pending}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Nr. platformă</span>
                <input
                  className={OPS_INPUT_CLASS}
                  value={plate}
                  disabled={pending}
                  onChange={(e) => setPlate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Destinație predare</span>
                <input
                  className={OPS_INPUT_CLASS}
                  value={dropoff}
                  disabled={pending}
                  onChange={(e) => setDropoff(e.target.value)}
                  placeholder="Service / adresă"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => void onCreate()}
              className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Deschide misiune tractare
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            {hasSupplier
              ? "Nicio misiune pe această intervenție."
              : "Alegeți un furnizor asistență pe intervenție înainte de misiune."}
          </p>
        )
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 px-3 py-2">
            <p className="text-sm text-zinc-100">
              {rsaMissionStatusLabel(mission.status)}
              {mission.driverDisplayName ? ` · ${mission.driverDisplayName}` : ""}
              {mission.platformPlate ? ` · ${mission.platformPlate}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {mission.pickupLocationText ?? "—"} → {mission.dropoffLocationText ?? "—"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
              {mission.protocols.map((p) => (
                <span key={p.id}>
                  {p.kind}: {p.status} ({p.signatureCount} semne / {p.mediaCount} foto)
                </span>
              ))}
            </div>
          </div>

          <RsaDropoffQr
            missionId={mission.id}
            dropoffLocationText={mission.dropoffLocationText}
            vehicleReg={mission.vehicleReg}
            compact
          />

          <div className="flex flex-wrap gap-2">
            {canWrite && NEXT[mission.status] ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void advance()}
                className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {NEXT_LABEL[mission.status] ?? "Avansare"}
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
                className="rounded-lg border border-rose-800/60 px-3 py-2 text-sm text-rose-300 disabled:opacity-50"
              >
                Anulează misiunea
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["pickup", "dropoff"] as RsaHandoverKind[]).map((kind) => {
              const existing = mission.protocols.find((p) => p.kind === kind);
              const canOpenNew =
                canWrite &&
                mission.status !== "cancelled" &&
                mission.status !== "closed";
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={pending || (!existing && !canOpenNew)}
                  onClick={() => {
                    if (existing) void openExisting(existing.id);
                    else if (canOpenNew) void openKind(kind);
                  }}
                  className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
                >
                  {rsaHandoverKindLabel(kind)}
                  {existing ? ` · ${existing.status}` : ""}
                </button>
              );
            })}
          </div>

          {(canSettleUi || mission.settlementCostEntryId) && (
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <h5 className="text-sm font-medium text-zinc-100">Decont RSA (S4)</h5>
              {mission.settlementCostEntryId ? (
                <p className="text-sm text-emerald-400">
                  Decontat {formatRon(mission.settlementAmountCents ?? 0)}
                  {mission.distanceKm != null ? ` · ${mission.distanceKm} km` : ""}
                  <span className="ml-1 text-xs text-zinc-500">
                    cost {mission.settlementCostEntryId.slice(0, 8)}…
                  </span>
                </p>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className={OPS_LABEL_CLASS}>Km tractați</span>
                    <input
                      className={OPS_INPUT_CLASS}
                      inputMode="numeric"
                      value={distanceKm}
                      disabled={pending || !canWrite}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      placeholder="ex. 45"
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
                    onClick={() => void onPreviewSettle()}
                    className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
                  >
                    Preview
                  </button>
                  {canWrite ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void onSettle()}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Generează CostEntry
                    </button>
                  ) : null}
                </div>
              )}
              {preview ? (
                <ul className="space-y-0.5 text-xs text-zinc-400">
                  <li>
                    {preview.mode} · entitlement {preview.entitlementStatus} ·{" "}
                    {formatRon(preview.amountCents)}
                  </li>
                  {preview.lines.map((l) => (
                    <li key={l.code}>
                      {l.label}: {formatRon(l.cents)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {protocol ? (
            <RsaHandoverPanel
              key={protocol.id}
              protocol={protocol}
              canWrite={canWrite && protocol.status === "draft"}
              onUpdated={(p) => {
                setProtocol(p);
                void refresh({ soft: true });
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
