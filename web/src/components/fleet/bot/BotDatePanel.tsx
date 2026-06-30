"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  botBrowserBase,
  fleetJsonHeaders,
  type BotCatalogPayload,
  type BotDivision,
  type BotMode,
  type BotModuleDefinition,
  type BotModuleOperations,
  type BotScenarioPreset,
  type StartBotSessionInput,
} from "@/lib/bot-api";

type ModuleState = Record<string, BotModuleOperations>;

function defaultModuleState(modules: BotModuleDefinition[]): ModuleState {
  const out: ModuleState = {};
  for (const m of modules) {
    out[m.id] = {
      create: 0,
      edit: 0,
      delete: 0,
      options: Object.fromEntries(
        (m.optionFields ?? []).map((f) => [f.key, f.defaultValue ?? (f.type === "boolean" ? false : "")]),
      ),
    };
  }
  return out;
}

function applyScenario(modules: BotModuleDefinition[], scenario: BotScenarioPreset): ModuleState {
  const base = defaultModuleState(modules);
  for (const [id, ops] of Object.entries(scenario.modules)) {
    base[id] = { ...base[id], ...ops, options: { ...base[id]?.options, ...ops.options } };
  }
  return base;
}

export function BotDatePanel() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<BotCatalogPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [division, setDivision] = useState<BotDivision>("alpha");
  const [seed, setSeed] = useState(42);
  const [mode, setMode] = useState<BotMode>("populate");
  const [concurrentUsers, setConcurrentUsers] = useState(1);
  const [moduleState, setModuleState] = useState<ModuleState>({});
  const [faults, setFaults] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${botBrowserBase}/modules`);
        if (!res.ok) {
          setLoadError(`Nu s-a putut încărca catalogul BOT (HTTP ${res.status})`);
          return;
        }
        const data = (await res.json()) as BotCatalogPayload;
        setCatalog(data);
        setModuleState(defaultModuleState(data.modules));
      } catch {
        setLoadError("Eroare la încărcarea catalogului BOT.");
      }
    })();
  }, []);

  const modulesByDomain = useMemo(() => {
    if (!catalog) return [];
    const domains = ["operations", "crm", "admin"] as const;
    return domains.map((d) => ({
      domain: d,
      items: catalog.modules.filter((m) => m.domain === d),
    }));
  }, [catalog]);

  const setOp = useCallback((moduleId: string, op: "create" | "edit" | "delete", value: number) => {
    setModuleState((prev) => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [op]: Math.max(0, value) },
    }));
  }, []);

  const setOption = useCallback((moduleId: string, key: string, value: unknown) => {
    setModuleState((prev) => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        options: { ...prev[moduleId]?.options, [key]: value },
      },
    }));
  }, []);

  async function runSession(preset?: BotScenarioPreset) {
    if (!catalog) return;
    setPending(true);
    setRunError(null);
    const modules = preset ? applyScenario(catalog.modules, preset) : moduleState;
    const body: StartBotSessionInput = {
      scenarioId: preset?.id ?? "custom",
      division: preset?.division ?? division,
      seed,
      mode,
      concurrentUsers,
      modules,
      faults: mode === "fault_test" ? faults : undefined,
    };
    try {
      const res = await fetch(`${botBrowserBase}/sessions`, {
        method: "POST",
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
        setRunError(msg);
        return;
      }
      const session = (await res.json()) as { id: string };
      router.push(`/fleet/bot/raportare/${session.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (loadError) {
    return <p className="text-sm text-rose-400">{loadError}</p>;
  }

  if (!catalog) {
    return <p className="text-sm text-zinc-500">Se încarcă catalogul modulelor…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200/90">
        Tenant <span className="font-mono">{catalog.constraints.tenantSlug}</span> · rol minim{" "}
        <span className="font-mono">{catalog.constraints.minRole}</span>. Date coerente, seed reproductibil.
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Diviziune demo
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value as BotDivision)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="alpha">Client Alpha</option>
            <option value="beta">Client Beta</option>
            <option value="tenant_wide">Tot tenant-ul</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Seed (reproductibil)
          <input
            type="number"
            min={1}
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Mod
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as BotMode)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="populate">Populate</option>
            <option value="fault_test">Fault test</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Utilizatori concurenți
          <input
            type="number"
            min={1}
            max={100}
            value={concurrentUsers}
            onChange={(e) => setConcurrentUsers(parseInt(e.target.value, 10) || 1)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            title={catalog.constraints.multiUserNote}
          />
          <span className="text-[10px] text-zinc-600">Rezervat — simulare multi-user viitoare</span>
        </label>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Preset-uri</h2>
        <div className="flex flex-wrap gap-2">
          {catalog.scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              onClick={() => void runSession(s)}
              className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-left text-sm hover:bg-zinc-900 disabled:opacity-50"
            >
              <span className="font-medium text-zinc-100">{s.label}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">{s.description}</span>
            </button>
          ))}
        </div>
      </section>

      {mode === "fault_test" ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Erori intenționate</h2>
          <ul className="space-y-2">
            {catalog.faults.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={faults.includes(f.id)}
                  onChange={(e) =>
                    setFaults((prev) =>
                      e.target.checked ? [...prev, f.id] : prev.filter((x) => x !== f.id),
                    )
                  }
                  className="mt-1"
                />
                <div>
                  <p className="text-zinc-200">{f.label}</p>
                  <p className="text-xs text-zinc-500">{f.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {modulesByDomain.map(({ domain, items }) =>
        items.length === 0 ? null : (
          <section key={domain}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">{domain}</h2>
            <div className="space-y-3">
              {items.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-4 ${
                    m.implemented ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-800/60 bg-zinc-950/30 opacity-80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-100">{m.label}</p>
                      <p className="text-xs text-zinc-500">{m.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!m.implemented ? (
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500">
                          În curând
                        </span>
                      ) : null}
                      {m.supportsMobile ? (
                        <span className="rounded-full border border-sky-900/50 px-2 py-0.5 text-[10px] text-sky-400/80">
                          Mobile-ready
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {m.operations.map((op) => (
                      <label key={op} className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="w-12 capitalize">{op}</span>
                        <input
                          type="number"
                          min={0}
                          max={m.maxPerOperation}
                          disabled={!m.implemented || pending}
                          value={moduleState[m.id]?.[op] ?? 0}
                          onChange={(e) => setOp(m.id, op, parseInt(e.target.value, 10) || 0)}
                          className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                        />
                      </label>
                    ))}
                  </div>
                  {m.optionFields && m.optionFields.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-zinc-800/80 pt-3">
                      {m.optionFields.map((f) => (
                        <div key={f.key} className="text-xs">
                          {f.type === "boolean" ? (
                            <label className="flex items-center gap-2 text-zinc-400">
                              <input
                                type="checkbox"
                                disabled={!m.implemented}
                                checked={Boolean(moduleState[m.id]?.options?.[f.key])}
                                onChange={(e) => setOption(m.id, f.key, e.target.checked)}
                              />
                              {f.label}
                              {f.hint ? <span className="text-zinc-600">— {f.hint}</span> : null}
                            </label>
                          ) : (
                            <label className="flex flex-col gap-1 text-zinc-400">
                              {f.label}
                              <select
                                disabled={!m.implemented}
                                value={String(moduleState[m.id]?.options?.[f.key] ?? f.defaultValue ?? "")}
                                onChange={(e) => setOption(m.id, f.key, e.target.value)}
                                className="max-w-xs rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                              >
                                {(f.options ?? []).map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ),
      )}

      {runError ? <p className="text-sm text-rose-400">{runError}</p> : null}

      <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-zinc-800 bg-zinc-950/95 py-4 backdrop-blur-sm">
        <button
          type="button"
          disabled={pending}
          onClick={() => void runSession()}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Rulează sesiunea…" : "Rulează sesiune custom"}
        </button>
        <Link
          href="/fleet/bot/raportare"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Raportare
        </Link>
      </div>
    </div>
  );
}
