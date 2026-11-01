"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { workOrdersBrowserBase } from "@/lib/work-orders-api";
import type { WorkOrderDetail } from "@/lib/work-orders-api";

type TireSetSummary = {
  id: string;
  season: string;
  name: string | null;
  isMounted: boolean;
  itemCount: number;
};

const INTENTS: { value: string; label: string }[] = [
  { value: "seasonal_changeover", label: "Schimb sezonier" },
  { value: "roadside_puncture", label: "Punctură / roadside" },
  { value: "purchase", label: "Achiziție montaj" },
  { value: "diagnostic_wheel", label: "Diagnostic roată" },
  { value: "rim_service", label: "Service jante" },
  { value: "storage_only", label: "Doar depozitare" },
  { value: "eol_replace", label: "Înlocuire EOL" },
];

const POSITIONS = ["fl", "fr", "rl", "rr"] as const;

type Props = {
  wo: WorkOrderDetail;
  canWrite: boolean;
};

export function TyreClosePanel({ wo, canWrite }: Props) {
  const router = useRouter();
  const [sets, setSets] = useState<TireSetSummary[]>([]);
  const [intent, setIntent] = useState(wo.tyreWorkIntent ?? "seasonal_changeover");
  const [demountSetId, setDemountSetId] = useState("");
  const [mountSetId, setMountSetId] = useState("");
  const [storeAt, setStoreAt] = useState<"at_supplier_hotel" | "at_client">("at_client");
  const [puncturePos, setPuncturePos] = useState<(typeof POSITIONS)[number]>("fl");
  const [newDot, setNewDot] = useState("");
  const [newTread, setNewTread] = useState("");
  const [odometerKm, setOdometerKm] = useState(
    wo.odometerKmOut != null
      ? String(wo.odometerKmOut)
      : wo.odometerKmIn != null
        ? String(wo.odometerKmIn)
        : "",
  );
  const [demountTreads, setDemountTreads] = useState<Record<(typeof POSITIONS)[number], string>>({
    fl: "",
    fr: "",
    rl: "",
    rr: "",
  });
  const [inspectTread, setInspectTread] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applied = !!wo.tyreCloseAppliedAt;
  const isSeasonal = intent === "seasonal_changeover";
  const isPuncture =
    intent === "roadside_puncture" || intent === "eol_replace" || intent === "purchase";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${workOrdersBrowserBase}/${wo.id}/tire-sets`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { sets?: TireSetSummary[] };
        if (!cancelled && Array.isArray(data.sets)) setSets(data.sets);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wo.id]);

  const mountedSet = useMemo(() => sets.find((s) => s.isMounted), [sets]);
  const storageSets = useMemo(() => sets.filter((s) => !s.isMounted), [sets]);

  useEffect(() => {
    if (mountedSet && !demountSetId) setDemountSetId(mountedSet.id);
    if (storageSets[0] && !mountSetId) setMountSetId(storageSets[0].id);
  }, [mountedSet, storageSets, demountSetId, mountSetId]);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const km = Number(odometerKm);
      if (!Number.isFinite(km) || km < 0) {
        throw new Error("Odometrul (km) este obligatoriu");
      }
      const body: Record<string, unknown> = { intent, odometerKm: Math.round(km) };
      if (isSeasonal) {
        if (!demountSetId || !mountSetId) {
          throw new Error("Selectează set demontat și set montat");
        }
        const demountReadings = POSITIONS.map((position) => {
          const raw = demountTreads[position].trim();
          if (!raw) return null;
          const treadMm = Number(raw);
          if (!Number.isFinite(treadMm)) {
            throw new Error(`Profil invalid pe ${position.toUpperCase()}`);
          }
          return { position, treadMm };
        }).filter((r): r is { position: (typeof POSITIONS)[number]; treadMm: number } => r != null);
        if (demountReadings.length === 0) {
          throw new Error("Completează profilul (mm) pe pozițiile demontate");
        }
        body.seasonalSwap = { demountSetId, mountSetId, storeAt, demountReadings };
      } else if (isPuncture) {
        if (!newDot.trim()) throw new Error("DOT anvelopă nouă este obligatoriu");
        if (!newTread.trim() || !Number.isFinite(Number(newTread))) {
          throw new Error("Profil mm anvelopă nouă este obligatoriu");
        }
        body.outcomes = [
          {
            position: puncturePos,
            outcome: "replaced",
            treadMm: Number(newTread),
            newAsset: {
              dot: newDot.trim(),
              treadMm: Number(newTread),
            },
          },
        ];
      } else {
        if (!inspectTread.trim() || !Number.isFinite(Number(inspectTread))) {
          throw new Error("Profil mm măsurat este obligatoriu");
        }
        body.outcomes = [
          { position: "fl", outcome: "inspected_ok", treadMm: Number(inspectTread) },
        ];
      }
      const res = await fetch(`${workOrdersBrowserBase}/${wo.id}/tyre-close`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  if (wo.serviceOrderType !== "R") return null;

  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
        Închidere anvelope
      </div>
      {applied ? (
        <p className="mt-2 text-xs text-zinc-400">
          Operațiune aplicată{" "}
          {wo.tyreCloseAppliedAt
            ? new Date(wo.tyreCloseAppliedAt).toLocaleString("ro-RO")
            : ""}
          {wo.tyreWorkIntent ? ` · intent: ${wo.tyreWorkIntent}` : ""}
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          <label className="block text-zinc-400">
            Intent
            <select
              value={intent}
              disabled={!canWrite || pending}
              onChange={(e) => setIntent(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
            >
              {INTENTS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-zinc-400">
            Odometru (km) <span className="text-amber-400">*</span>
            <input
              value={odometerKm}
              disabled={!canWrite || pending}
              onChange={(e) => setOdometerKm(e.target.value)}
              inputMode="numeric"
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
            />
          </label>

          {isSeasonal ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-zinc-400">
                Set demontat
                <select
                  value={demountSetId}
                  disabled={!canWrite || pending}
                  onChange={(e) => setDemountSetId(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                >
                  <option value="">—</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.name ?? s.season) + (s.isMounted ? " (montat)" : "")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-zinc-400">
                Set montat
                <select
                  value={mountSetId}
                  disabled={!canWrite || pending}
                  onChange={(e) => setMountSetId(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                >
                  <option value="">—</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.name ?? s.season) + (s.isMounted ? " (montat)" : "")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-zinc-400 sm:col-span-2">
                Depozitare set demontat
                <select
                  value={storeAt}
                  disabled={!canWrite || pending}
                  onChange={(e) =>
                    setStoreAt(e.target.value as "at_supplier_hotel" | "at_client")
                  }
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                >
                  <option value="at_client">La client</option>
                  <option value="at_supplier_hotel">
                    Hotel furnizor (înregistrare automată la închidere)
                  </option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <p className="mb-1 text-zinc-400">
                  Profil demontat (mm) pe poziție <span className="text-amber-400">*</span>
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {POSITIONS.map((p) => (
                    <label key={p} className="text-zinc-500">
                      {p.toUpperCase()}
                      <input
                        value={demountTreads[p]}
                        disabled={!canWrite || pending}
                        onChange={(e) =>
                          setDemountTreads((prev) => ({ ...prev, [p]: e.target.value }))
                        }
                        inputMode="decimal"
                        className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {isPuncture ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-zinc-400">
                Poziție
                <select
                  value={puncturePos}
                  disabled={!canWrite || pending}
                  onChange={(e) => setPuncturePos(e.target.value as (typeof POSITIONS)[number])}
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-zinc-400">
                DOT nou <span className="text-amber-400">*</span>
                <input
                  value={newDot}
                  disabled={!canWrite || pending}
                  onChange={(e) => setNewDot(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                />
              </label>
              <label className="text-zinc-400">
                Profil mm <span className="text-amber-400">*</span>
                <input
                  value={newTread}
                  disabled={!canWrite || pending}
                  onChange={(e) => setNewTread(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                />
              </label>
            </div>
          ) : null}

          {!isSeasonal && !isPuncture ? (
            <label className="block text-zinc-400">
              Profil măsurat FL (mm) <span className="text-amber-400">*</span>
              <input
                value={inspectTread}
                disabled={!canWrite || pending}
                onChange={(e) => setInspectTread(e.target.value)}
                inputMode="decimal"
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
          ) : null}

          {error ? <p className="text-amber-300">{error}</p> : null}

          {canWrite ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void submit()}
              className="rounded-lg border border-emerald-600/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
            >
              {pending ? "Se aplică…" : "Aplică închidere anvelope"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
