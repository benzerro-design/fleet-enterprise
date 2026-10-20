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
      const body: Record<string, unknown> = { intent };
      if (isSeasonal) {
        if (!demountSetId || !mountSetId) {
          throw new Error("Selectează set demontat și set montat");
        }
        body.seasonalSwap = { demountSetId, mountSetId, storeAt };
      } else if (isPuncture) {
        body.outcomes = [
          {
            position: puncturePos,
            outcome: "replaced",
            newAsset: {
              dot: newDot.trim() || null,
              treadMm: newTread.trim() ? Number(newTread) : null,
            },
          },
        ];
      } else {
        body.outcomes = [{ position: "fl", outcome: "inspected_ok" }];
      }
      const res = await fetch(`${workOrdersBrowserBase}/${wo.id}/tyre-close`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
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
                  <option value="at_supplier_hotel">Hotel furnizor (înregistrare automată la închidere)</option>
                </select>
              </label>
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
                DOT nou
                <input
                  value={newDot}
                  disabled={!canWrite || pending}
                  onChange={(e) => setNewDot(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                />
              </label>
              <label className="text-zinc-400">
                Profil mm
                <input
                  value={newTread}
                  disabled={!canWrite || pending}
                  onChange={(e) => setNewTread(e.target.value)}
                  className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                />
              </label>
            </div>
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
