"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  fetchFunctionalProfileMatrixClient,
  resetFunctionalProfileMatrix,
  saveFunctionalProfileMatrix,
} from "@/lib/functional-profile-matrix/functional-profile-matrix-api";
import type {
  FunctionalCapability,
  FunctionalProfileKey,
  FunctionalProfileMatrixEffective,
  FunctionalProfileMatrixResponse,
} from "@/lib/functional-profile-matrix/types";

const PROFILES: FunctionalProfileKey[] = ["F", "T", "G", "full"];

const CAPABILITY_ROWS: { cap: FunctionalCapability; label: string; detail: string }[] = [
  {
    cap: "quote.approve",
    label: "Aprobă devizul",
    detail: "Devizul trimis spre aprobare.",
  },
  {
    cap: "quote.edit",
    label: "Editează devizul",
    detail: "Linii, cantități, prețuri, versiune nouă.",
  },
  {
    cap: "quote.postCost",
    label: "Trece costul după factură",
    detail: "Costul pornește din devizul facturat.",
  },
  {
    cap: "scheduler.write",
    label: "Programează service",
    detail: "Programare, intrare/ieșire service pe tichet.",
  },
  {
    cap: "fleet.write",
    label: "Scrie în flotă",
    detail: "Curse, costuri și alte înregistrări operaționale.",
  },
];

type Props = {
  initial: FunctionalProfileMatrixResponse | null;
};

export function UserStrategyRights({ initial }: Props) {
  const [data, setData] = useState<FunctionalProfileMatrixResponse | null>(initial);
  const [draft, setDraft] = useState<FunctionalProfileMatrixEffective | null>(initial?.effective ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = useMemo(() => {
    if (!data || !draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(data.effective);
  }, [data, draft]);

  const toggle = useCallback((profile: FunctionalProfileKey, cap: FunctionalCapability) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [profile]: { ...prev[profile], [cap]: !prev[profile][cap] },
      };
    });
  }, []);

  async function reload() {
    const next = await fetchFunctionalProfileMatrixClient();
    if (next) {
      setData(next);
      setDraft(structuredClone(next.effective));
    }
  }

  async function onSave() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const override: FunctionalProfileMatrixResponse["override"] = {};
      for (const profile of PROFILES) {
        override[profile] = { ...draft[profile] };
      }
      const next = await saveFunctionalProfileMatrix(override ?? {});
      setData(next);
      setDraft(structuredClone(next.effective));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setBusy(true);
    setError(null);
    try {
      const next = await resetFunctionalProfileMatrix();
      setData(next);
      setDraft(structuredClone(next.effective));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset eșuat");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !draft) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
        <p className="text-amber-400">
          Nu am putut încărca matricea F/T/G. Verifică API-ul și migrarea{" "}
          <code className="font-mono text-zinc-400">20261021180000_iam004_iam007_tenant_matrix_grid_views</code>.
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-4 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Reîncearcă
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">Drepturi</p>
      <h2 className="mt-1 text-lg font-semibold text-zinc-50">Matrice F/T/G (IAM-004)</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Override pe abonat pentru capabilitățile IAM-003. Rolurile R* (partener) nu sunt afectate. Profilul se alocă
        în{" "}
        <Link href="/fleet/members" className="text-emerald-400 hover:underline">
          Membri & invitații
        </Link>
        ; tab-ul Hartă rămâne pentru ierarhie.
      </p>

      {data.isDefault ? (
        <p className="mt-3 text-xs text-zinc-500">Folosești defaults din cod (fără override salvat).</p>
      ) : (
        <p className="mt-3 text-xs text-emerald-400/90">
          Override activ{data.updatedAt ? ` — actualizat ${new Date(data.updatedAt).toLocaleString("ro-RO")}` : ""}.
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">Capabilități pe profil F, T, G, Full</caption>
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-4 font-medium">Capabilitate</th>
              {PROFILES.map((profile) => (
                <th key={profile} className="px-2 py-2 text-center font-medium">
                  {profile === "full" ? "Full" : profile}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_ROWS.map((row) => (
              <tr key={row.cap} className="border-b border-zinc-800/80 align-top">
                <th className="py-3 pr-4 font-medium text-zinc-100">
                  {row.label}
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">{row.detail}</span>
                </th>
                {PROFILES.map((profile) => (
                  <td key={profile} className="px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={draft[profile][row.cap]}
                      onChange={() => toggle(profile, row.cap)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500"
                      aria-label={`${row.label} — ${profile}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Fără profil pe user (= legacy) înseamnă în continuare toate drepturile pe axa F/T/G; matricea se aplică doar
        când profilul F/T/G/full este setat.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void onSave()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-emerald-500"
        >
          {busy ? "Se salvează…" : "Salvează override"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onReset()}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
        >
          Revino la defaults
        </button>
        {savedFlash ? <span className="text-sm text-emerald-400">Salvat.</span> : null}
        {error ? <span className="text-sm text-red-400">{error}</span> : null}
      </div>
    </section>
  );
}
