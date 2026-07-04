"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetJsonHeaders, workOrdersBrowserBase } from "@/lib/work-orders-api";

type Props = {
  workOrderId: string;
  canWrite: boolean;
  inServiceAt: string | null;
  outServiceAt: string | null;
  odometerKmIn: number | null;
  odometerKmOut: number | null;
};

export function WorkOrderServiceIntake({
  workOrderId,
  canWrite,
  inServiceAt,
  outServiceAt,
  odometerKmIn,
  odometerKmOut,
}: Props) {
  const router = useRouter();
  const [kmIn, setKmIn] = useState(odometerKmIn != null ? String(odometerKmIn) : "");
  const [kmOut, setKmOut] = useState(odometerKmOut != null ? String(odometerKmOut) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, string | number>) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/service-times`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function markIn() {
    const body: Record<string, string | number> = {
      inServiceAt: new Date().toISOString(),
    };
    if (kmIn.trim()) {
      const n = parseInt(kmIn, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km intrare invalid.");
        return;
      }
      body.odometerKmIn = n;
    }
    await patch(body);
  }

  async function markOut() {
    const body: Record<string, string | number> = {
      outServiceAt: new Date().toISOString(),
    };
    if (kmOut.trim()) {
      const n = parseInt(kmOut, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km ieșire invalid.");
        return;
      }
      body.odometerKmOut = n;
    }
    await patch(body);
  }

  async function saveKmOnly() {
    const body: Record<string, number> = {};
    if (kmIn.trim()) {
      const n = parseInt(kmIn, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km intrare invalid.");
        return;
      }
      body.odometerKmIn = n;
    }
    if (kmOut.trim()) {
      const n = parseInt(kmOut, 10);
      if (!Number.isFinite(n) || n < 0) {
        setError("Km ieșire invalid.");
        return;
      }
      body.odometerKmOut = n;
    }
    if (Object.keys(body).length === 0) return;
    await patch(body);
  }

  return (
    <section className="mt-6 rounded-xl border border-violet-800/40 bg-violet-950/10 p-4">
      <h2 className="text-sm font-medium text-violet-200">Mașina la service</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Marchează când vehiculul intră și iese — km opțional, util pentru istoric.
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={OPS_LABEL_CLASS}>Km intrare</label>
          <input
            type="number"
            min={0}
            value={kmIn}
            onChange={(e) => setKmIn(e.target.value)}
            disabled={!canWrite}
            className={OPS_INPUT_CLASS}
            placeholder="Opțional"
          />
          <p className="mt-1 text-xs text-zinc-500">
            In:{" "}
            {inServiceAt ? new Date(inServiceAt).toLocaleString("ro-RO") : "—"}
          </p>
        </div>
        <div>
          <label className={OPS_LABEL_CLASS}>Km ieșire</label>
          <input
            type="number"
            min={0}
            value={kmOut}
            onChange={(e) => setKmOut(e.target.value)}
            disabled={!canWrite}
            className={OPS_INPUT_CLASS}
            placeholder="Opțional"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Out:{" "}
            {outServiceAt ? new Date(outServiceAt).toLocaleString("ro-RO") : "—"}
          </p>
        </div>
      </div>

      {canWrite ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {!inServiceAt ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void markIn()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Mașina a intrat
            </button>
          ) : null}
          {inServiceAt && !outServiceAt ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void markOut()}
              className="rounded-lg border border-violet-500/50 px-3 py-1.5 text-sm text-violet-100 hover:bg-violet-950/40 disabled:opacity-50"
            >
              Mașina a ieșit
            </button>
          ) : null}
          {(inServiceAt || outServiceAt) && (kmIn.trim() || kmOut.trim()) ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void saveKmOnly()}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              Salvează km
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
