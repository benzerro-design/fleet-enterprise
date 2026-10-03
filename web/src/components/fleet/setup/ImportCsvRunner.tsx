"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import type { ImportSettings, ImportTemplateSetting } from "@/lib/import-settings";

type ImportJob = {
  id: string;
  entity: string;
  templateId: string | null;
  status: string;
  dryRun: boolean;
  fileName: string | null;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorReport: { row: number; message: string }[];
  summary: Record<string, unknown> | null;
  createdAt: string;
};

type Props = { settings: ImportSettings };

const IMPORTS_BASE = "/api/imports";

export function ImportCsvRunner({ settings }: Props) {
  const enabledEntities = useMemo(
    () =>
      settings.entities.filter(
        (e) =>
          e.enabled &&
          ["vehicles", "drivers", "suppliers", "costs", "documents"].includes(e.code),
      ),
    [settings.entities],
  );
  const [entity, setEntity] = useState(enabledEntities[0]?.code ?? "vehicles");
  const templates = useMemo(
    () => settings.templates.filter((t) => t.enabled && t.entity === entity),
    [settings.templates, entity],
  );
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastJob, setLastJob] = useState<ImportJob | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);

  useEffect(() => {
    setTemplateId(templates[0]?.id ?? "");
  }, [templates]);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`${IMPORTS_BASE}/jobs`, {
        headers: fleetJsonHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as ImportJob[];
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsText(file, "UTF-8");
  }

  async function run(dryRun: boolean) {
    setPending(true);
    setError(null);
    setLastJob(null);
    try {
      const res = await fetch(`${IMPORTS_BASE}/run`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          entity,
          templateId: templateId || null,
          csvText,
          dryRun,
          fileName,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const job = (await res.json()) as ImportJob;
      setLastJob(job);
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare import");
    } finally {
      setPending(false);
    }
  }

  const selectedTpl: ImportTemplateSetting | undefined = templates.find((t) => t.id === templateId);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-200">Motor CSV</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Upload CSV → dry-run (validare) → scriere DB. Vehicul / șofer / furnizor / cost / document.
          Pentru Excel: exportă ca CSV (UTF-8). XLSX nativ vine ulterior.
          {settings.requireDryRun ? " Dry-run e recomandat înainte de scriere." : null}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-zinc-400">
          Entitate
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
          >
            {enabledEntities.map((e) => (
              <option key={e.code} value={e.code}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Șablon
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
          >
            <option value="">— fără validare coloane —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedTpl ? (
        <p className="font-mono text-[11px] text-zinc-500">Coloane: {selectedTpl.columns.join(", ")}</p>
      ) : null}

      <label className="block text-xs text-zinc-400">
        Fișier CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block w-full text-sm text-zinc-300"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {csvText ? (
        <p className="text-xs text-zinc-500">
          {fileName ?? "CSV"} — {csvText.split(/\r?\n/).filter((l) => l.trim()).length - 1} rânduri (estimat)
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !csvText.trim()}
          onClick={() => void run(true)}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Dry-run
        </button>
        <button
          type="button"
          disabled={pending || !csvText.trim()}
          onClick={() => void run(false)}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Scrie în DB
        </button>
      </div>

      {lastJob ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
          <p className="font-medium text-zinc-200">
            Ultimul job: {lastJob.status}
            {lastJob.dryRun ? " (dry-run)" : ""} — ok {lastJob.successRows}/{lastJob.totalRows}, erori{" "}
            {lastJob.errorRows}
          </p>
          {lastJob.summary ? (
            <p className="mt-1 text-zinc-500">
              Summary: {JSON.stringify(lastJob.summary)}
            </p>
          ) : null}
          {lastJob.errorReport?.length ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-amber-200/90">
              {lastJob.errorReport.slice(0, 30).map((err, i) => (
                <li key={`${err.row}-${i}`}>
                  Rând {err.row}: {err.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Istoric</h3>
        {jobs.length === 0 ? (
          <p className="text-xs text-zinc-600">Niciun job încă.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-xs">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-zinc-400">
                <span>
                  <span className="text-zinc-200">{j.entity}</span>
                  {j.fileName ? ` · ${j.fileName}` : ""}
                  {j.dryRun ? " · dry-run" : ""}
                </span>
                <span className="font-mono">
                  {j.successRows}/{j.totalRows} ok · {j.errorRows} err · {j.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
