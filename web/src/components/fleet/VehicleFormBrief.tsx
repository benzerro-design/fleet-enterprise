"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OpsVehicleOption } from "@/lib/ops-form-context";
import {
  type OpsFormModuleKey,
  BRIEF_LIMIT_OPTIONS,
  BRIEF_MODULE_HEADERS,
  DEFAULT_BRIEF_LIMIT,
  OPS_FORM_MODULE_LABELS,
  OPS_FORM_MODULE_ORDER,
  OPS_SECTION_ACCENT,
  readBriefLimit,
  writeBriefLimit,
} from "@/lib/ops-section-theme";
import { fetchVehicleFormBrief } from "@/lib/vehicle-form-brief-client";
import type { VehicleFormBriefEntry, VehicleFormBriefPayload } from "@/lib/vehicle-form-brief-types";

type Props = {
  activeModule: OpsFormModuleKey;
  vehicleId: string;
  onVehicleIdChange: (id: string) => void;
  vehicles: OpsVehicleOption[];
  vehicleLocked?: boolean;
};

function BriefChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CompliancePill({ status }: { status: "valid" | "expired" | "missing" }) {
  if (status === "valid") {
    return (
      <span className="rounded-full border border-emerald-900/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-300/90">
        În termen
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="rounded-full border border-amber-900/50 bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-300/90">
        Expirat
      </span>
    );
  }
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400">
      Lipsă
    </span>
  );
}

function BriefLimitControl({
  moduleKey,
  total,
  value,
  onChange,
}: {
  moduleKey: OpsFormModuleKey;
  total: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span title="Total înregistrări" className="min-w-[14px] text-right font-mono text-[9px] text-zinc-600">
        {total}
      </span>
      <span title="Afișează" className="text-[8px] text-zinc-600">
        Afiș.
      </span>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          writeBriefLimit(moduleKey, e.target.value);
        }}
        title="Rânduri afișate"
        className="h-[17px] w-10 cursor-pointer appearance-none rounded border border-zinc-700 bg-zinc-950 px-1 pr-4 font-mono text-[9px] text-zinc-400 outline-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 20 20' fill='%2371717a'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 3px center",
          backgroundSize: "8px",
        }}
      >
        {BRIEF_LIMIT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type BriefHoverState = {
  id: string;
  detail: Record<string, string>;
  top: number;
  left: number;
};

function BriefDetailPopover({ detail, top, left }: { detail: Record<string, string>; top: number; left: number }) {
  const maxLeft = typeof window !== "undefined" ? window.innerWidth - 240 : left;
  const clampedLeft = Math.min(left, maxLeft);

  return (
    <div
      className="pointer-events-none fixed z-50 w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 shadow-lg shadow-black/40"
      style={{ top, left: clampedLeft }}
      role="tooltip"
    >
      <p className="mb-1.5 text-[11px] font-semibold text-zinc-200">Detalii complete</p>
      <dl className="space-y-1">
        {Object.entries(detail).map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-2 text-[10px]">
            <dt className="shrink-0 text-zinc-500">{k}</dt>
            <dd className="min-w-0 text-right leading-snug text-zinc-200">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BriefTable({
  moduleKey,
  entries,
  displayLimit,
}: {
  moduleKey: OpsFormModuleKey;
  entries: VehicleFormBriefEntry[];
  displayLimit: number;
}) {
  const headers = BRIEF_MODULE_HEADERS[moduleKey];
  const rows = displayLimit > 0 ? entries.slice(0, displayLimit) : entries;
  const scrollable = rows.length > 8;
  const [hovered, setHovered] = useState<BriefHoverState | null>(null);

  function showPopover(row: VehicleFormBriefEntry, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    setHovered({
      id: row.id,
      detail: row.detail,
      top: rect.top,
      left: rect.right + 8,
    });
  }

  if (entries.length === 0) {
    return <p className="text-[11px] text-zinc-500">Nu există înregistrări.</p>;
  }

  return (
    <div className="relative">
      <div
        className={`overflow-x-auto rounded-lg border border-zinc-800 ${scrollable ? "max-h-[200px] overflow-y-auto" : ""}`}
        onMouseLeave={() => setHovered(null)}
      >
        <div
          className="sticky top-0 z-[1] grid gap-1 border-b border-zinc-800 bg-zinc-900/90 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
          style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
        >
          {headers.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className={`relative grid cursor-default gap-1 border-t border-zinc-800/50 px-2 py-1 text-[11px] text-zinc-300 ${
              hovered?.id === row.id ? "bg-zinc-800/60" : idx % 2 === 0 ? "bg-transparent" : "bg-zinc-950/30"
            }`}
            style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
            onMouseEnter={(e) => showPopover(row, e.currentTarget)}
            onMouseLeave={() => setHovered((prev) => (prev?.id === row.id ? null : prev))}
          >
            {row.cells.map((cell, i) => (
              <span key={i} className="truncate font-mono first:font-sans">
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
      {hovered ? <BriefDetailPopover detail={hovered.detail} top={hovered.top} left={hovered.left} /> : null}
      <p className="mt-1.5 text-[10px] text-zinc-600">
        Afișez {rows.length} din {entries.length}
        {scrollable ? " · scroll în zonă" : ""} · hover = detalii
      </p>
    </div>
  );
}

function BriefAccordionSection({
  moduleKey,
  isActive,
  payload,
  isLast,
}: {
  moduleKey: OpsFormModuleKey;
  isActive: boolean;
  payload: VehicleFormBriefPayload;
  isLast: boolean;
}) {
  const accent = OPS_SECTION_ACCENT[moduleKey];
  const mod = payload.modules[moduleKey];
  const [open, setOpen] = useState(isActive);
  const [limitRaw, setLimitRaw] = useState(() => readBriefLimit(moduleKey));

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const displayLimit = limitRaw === "all" ? 0 : Number.parseInt(limitRaw, 10) || DEFAULT_BRIEF_LIMIT;
  const shownCount = limitRaw === "all" ? mod.entries.length : Math.min(displayLimit, mod.entries.length);
  const barOpacity = open || isActive ? "opacity-100" : "opacity-40";

  const listHref = useMemo(() => {
    const reg = payload.vehicle.registrationNumber;
    const qs = `registrationNumber=${encodeURIComponent(reg)}`;
    if (moduleKey === "maintenance") return `/fleet/maintenance?${qs}`;
    if (moduleKey === "costs") return `/fleet/costs?${qs}`;
    if (moduleKey === "documents") return `/fleet/documents?${qs}`;
    if (moduleKey === "reminders") return `/fleet/reminders?registrationNumber=${encodeURIComponent(reg)}`;
    return `/fleet/trips?${qs}`;
  }, [moduleKey, payload.vehicle.registrationNumber]);

  return (
    <div className={isLast ? "" : "border-b border-zinc-800/80"}>
      <div className="relative flex items-stretch">
        <span className={`absolute bottom-0 left-0 top-0 w-0.5 ${accent.bar} ${barOpacity}`} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left outline-none transition-colors hover:bg-zinc-900/40 focus-visible:ring-2 focus-visible:ring-inset ${accent.ring}`}
        >
          <BriefChevron open={open} />
          <span className="text-xs font-medium text-zinc-100">{OPS_FORM_MODULE_LABELS[moduleKey]}</span>
          {!open ? (
            <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${accent.badge}`}>
              {shownCount}/{mod.total}
            </span>
          ) : null}
        </button>
        <div className="flex items-center self-center pr-2">
          <BriefLimitControl moduleKey={moduleKey} total={mod.total} value={limitRaw} onChange={setLimitRaw} />
        </div>
      </div>
      {open ? (
        <div className="border-t border-zinc-800/50 bg-zinc-950/20 px-3 pb-3 pt-2">
          <BriefTable moduleKey={moduleKey} entries={mod.entries} displayLimit={displayLimit} />
          <Link href={listHref} className="mt-2 inline-block text-[10px] text-sky-400/90 hover:underline">
            Vezi toate în lista {OPS_FORM_MODULE_LABELS[moduleKey].toLowerCase()} →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function fmtDateRo(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ro-RO");
}

export function VehicleFormBrief({ activeModule, vehicleId, onVehicleIdChange, vehicles, vehicleLocked = false }: Props) {
  const [payload, setPayload] = useState<VehicleFormBriefPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (vid: string) => {
    if (!vid) {
      setPayload(null);
      return;
    }
    setLoading(true);
    setError(false);
    const data = await fetchVehicleFormBrief(vid);
    setPayload(data);
    setError(!data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(vehicleId);
  }, [vehicleId, load]);

  const modelLabel = useMemo(() => {
    if (!payload) return "—";
    const parts = [payload.vehicle.brand, payload.vehicle.model].filter(Boolean);
    return parts.length ? parts.join(" ") : "—";
  }, [payload]);

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-zinc-300">Vehicul{vehicleLocked ? "" : " *"}</label>
        {vehicleLocked ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2">
              <span className="font-mono text-sm font-semibold text-zinc-100">
                {vehicles.find((v) => v.id === vehicleId)?.registrationNumber ??
                  payload?.vehicle.registrationNumber ??
                  "—"}
              </span>
              <span className="shrink-0 rounded-full border border-sky-800/60 bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300/90">
                Fixat
              </span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">Înregistrarea rămâne pe acest vehicul.</p>
          </>
        ) : (
          <select
            required
            value={vehicleId}
            onChange={(e) => onVehicleIdChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          >
            {vehicles.length === 0 ? <option value="">Nu există vehicule</option> : null}
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registrationNumber}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? <p className="text-[11px] text-zinc-500">Se încarcă contextul vehiculului…</p> : null}
      {error ? <p className="text-[11px] text-amber-400">Nu am putut încărca istoricul vehiculului.</p> : null}

      {payload ? (
        <>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-[11px]">
            <p className="text-sm font-semibold text-zinc-100">{payload.vehicle.registrationNumber}</p>
            <dl className="mt-2 space-y-1">
              {[
                ["Client", payload.vehicle.clientLegalName ?? payload.vehicle.clientId],
                ["Km", payload.vehicle.odometerKm.toLocaleString("ro-RO")],
                ["ITP", fmtDateRo(payload.vehicle.itpExpiresOn)],
                ["Model", modelLabel],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className={`text-zinc-200 ${k === "Km" ? "font-mono" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
            {payload.lastPeriodicRevision ? (
              <>
                <hr className="my-2 border-zinc-800" />
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Ultima revizie periodică</p>
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-zinc-400">{payload.lastPeriodicRevision.title}</span>
                  <span className="text-right text-zinc-200">
                    <span className="block">{fmtDateRo(payload.lastPeriodicRevision.performedOn)}</span>
                    {payload.lastPeriodicRevision.odometerKm != null ? (
                      <span className="font-mono text-[10px]">
                        {payload.lastPeriodicRevision.odometerKm.toLocaleString("ro-RO")} km
                      </span>
                    ) : null}
                  </span>
                </div>
              </>
            ) : null}
            <hr className="my-2 border-zinc-800" />
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Documente obligatorii</p>
            <ul className="mt-1 space-y-1">
              {(
                [
                  ["RCA", payload.compliance.rca],
                  ["CASCO", payload.compliance.casco],
                  ["Vignetă", payload.compliance.vignette],
                ] as const
              ).map(([label, item]) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">{label}</span>
                  <span className="flex items-center gap-2">
                    {item.status === "valid" && item.expiresOn ? (
                      <span className="text-[10px] text-zinc-600">{fmtDateRo(item.expiresOn)}</span>
                    ) : null}
                    <CompliancePill status={item.status} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold text-zinc-300">Istoric vehicul — toate modulele</p>
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30">
              {OPS_FORM_MODULE_ORDER.map((moduleKey, index) => (
                <BriefAccordionSection
                  key={moduleKey}
                  moduleKey={moduleKey}
                  isActive={moduleKey === activeModule}
                  payload={payload}
                  isLast={index === OPS_FORM_MODULE_ORDER.length - 1}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
