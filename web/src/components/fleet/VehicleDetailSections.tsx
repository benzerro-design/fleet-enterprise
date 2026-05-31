"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  VehicleCostsPanel,
  vehicleCostsSummary,
  type VehicleCostRow,
} from "@/components/fleet/VehicleCostsPanel";
import {
  VehicleDocumentsPanel,
  vehicleDocumentsSummary,
  type VehicleDocumentRow,
} from "@/components/fleet/VehicleDocumentsPanel";
import {
  VehicleMaintenancePanel,
  vehicleMaintenanceSummary,
  type VehicleMaintenanceRow,
} from "@/components/fleet/VehicleMaintenancePanel";
import { VehicleRemindersSection } from "@/components/fleet/VehicleRemindersSection";
import { VehicleMobilityPanel } from "@/components/fleet/VehicleMobilityPanel";
import { mobilitySummaryLabel, type VehicleMobilityPayload } from "@/lib/vehicle-mobility-types";

type SectionKey = "maintenance" | "costs" | "documents" | "reminders" | "mobility";

const SECTION_KEYS: SectionKey[] = ["maintenance", "costs", "documents", "reminders", "mobility"];

const DEFAULT_OPEN: Record<SectionKey, boolean> = {
  maintenance: true,
  costs: false,
  documents: false,
  reminders: false,
  mobility: false,
};

const ACCENT: Record<SectionKey, { bar: string; badge: string; ring: string }> = {
  maintenance: {
    bar: "bg-emerald-500/80",
    badge: "border-emerald-900/50 bg-emerald-950/40 text-emerald-300/90",
    ring: "focus-visible:ring-emerald-500/40",
  },
  costs: {
    bar: "bg-sky-500/80",
    badge: "border-sky-900/50 bg-sky-950/40 text-sky-300/90",
    ring: "focus-visible:ring-sky-500/40",
  },
  documents: {
    bar: "bg-violet-500/80",
    badge: "border-violet-900/50 bg-violet-950/40 text-violet-300/90",
    ring: "focus-visible:ring-violet-500/40",
  },
  reminders: {
    bar: "bg-fuchsia-500/80",
    badge: "border-fuchsia-900/50 bg-fuchsia-950/40 text-fuchsia-300/90",
    ring: "focus-visible:ring-fuchsia-500/40",
  },
  mobility: {
    bar: "bg-amber-500/80",
    badge: "border-amber-900/50 bg-amber-950/40 text-amber-300/90",
    ring: "focus-visible:ring-amber-500/40",
  },
};

type Props = {
  vehicleId: string;
  registrationNumber: string;
  write: boolean;
  regQs: string;
  maintenance: { ok: true; items: VehicleMaintenanceRow[]; total: number } | { ok: false };
  costs: { ok: true; items: VehicleCostRow[]; total: number } | { ok: false };
  documents: { ok: true; items: VehicleDocumentRow[]; total: number } | { ok: false };
  mobility: { ok: true; data: VehicleMobilityPayload } | { ok: false };
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function AccordionSection({
  sectionId,
  title,
  summary,
  open,
  onToggle,
  actions,
  children,
}: {
  sectionId: SectionKey;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const styles = ACCENT[sectionId];

  return (
    <div className="border-b border-zinc-800/80 last:border-b-0">
      <div className="relative flex items-stretch">
        <span className={`absolute bottom-0 left-0 top-0 w-0.5 ${styles.bar} ${open ? "opacity-100" : "opacity-40"}`} />
        <button
          type="button"
          id={`section-${sectionId}-trigger`}
          aria-expanded={open}
          aria-controls={`section-${sectionId}-panel`}
          onClick={onToggle}
          className={`group flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-zinc-900/40 focus-visible:ring-2 focus-visible:ring-inset ${styles.ring}`}
        >
          <Chevron open={open} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-100">{title}</span>
              {!open ? (
                <span className={`hidden truncate rounded-full border px-2 py-0.5 text-[10px] sm:inline ${styles.badge}`}>
                  {summary}
                </span>
              ) : null}
            </div>
            {!open ? <p className="mt-0.5 truncate text-xs text-zinc-500 sm:hidden">{summary}</p> : null}
          </div>
        </button>
        <div
          className="flex shrink-0 flex-wrap items-center gap-1.5 self-center px-3 py-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      </div>
      <div
        id={`section-${sectionId}-panel`}
        role="region"
        aria-labelledby={`section-${sectionId}-trigger`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-zinc-800/50 bg-zinc-950/20 px-4 pb-4 pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function VehicleDetailSections({
  vehicleId,
  registrationNumber,
  write,
  regQs,
  maintenance,
  costs,
  documents,
  mobility,
}: Props) {
  const storageKey = `fleet-vehicle-sections:${vehicleId}`;

  const [open, setOpen] = useState<Record<SectionKey, boolean>>(DEFAULT_OPEN);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<SectionKey, boolean>>;
        setOpen((prev) => ({
          maintenance: parsed.maintenance ?? prev.maintenance,
          costs: parsed.costs ?? prev.costs,
          documents: parsed.documents ?? prev.documents,
          reminders: parsed.reminders ?? prev.reminders,
          mobility: parsed.mobility ?? prev.mobility,
        }));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(open));
    } catch {
      /* ignore */
    }
  }, [open, storageKey, hydrated]);

  const openCount = SECTION_KEYS.filter((k) => open[k]).length;

  const expandAll = useCallback(() => {
    setOpen({
      maintenance: true,
      costs: true,
      documents: true,
      reminders: true,
      mobility: true,
    });
  }, []);

  const collapseAll = useCallback(() => {
    setOpen({
      maintenance: false,
      costs: false,
      documents: false,
      reminders: false,
      mobility: false,
    });
  }, []);

  const toggle = useCallback((key: SectionKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const summaries = useMemo(
    () => ({
      maintenance: maintenance.ok
        ? vehicleMaintenanceSummary(maintenance.items, maintenance.total)
        : "Indisponibil",
      costs: costs.ok ? vehicleCostsSummary(costs.items, costs.total) : "Indisponibil",
      documents: documents.ok
        ? vehicleDocumentsSummary(documents.items, documents.total)
        : "Indisponibil",
      reminders: "Centralizat pe vehicul",
      mobility: mobility.ok ? mobilitySummaryLabel(mobility.data) : "Indisponibil",
    }),
    [maintenance, costs, documents, mobility],
  );

  const sectionCount = SECTION_KEYS.length;

  const actionLinkClass =
    "rounded-md border border-zinc-700/80 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800/80";
  const actionPrimaryClass =
    "rounded-md bg-emerald-500/90 px-2.5 py-1 text-[11px] font-medium text-zinc-950 hover:bg-emerald-400";

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">Operațiuni vehicul</h2>
          <p className="mt-1 text-xs text-zinc-600">
            {openCount === 0
              ? "Toate secțiunile sunt închise"
              : openCount === 4
                ? "Toate secțiunile sunt deschise"
                : `${openCount} din 4 secțiuni deschise`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={expandAll}
            disabled={openCount === sectionCount}
            className="rounded-lg border border-zinc-700/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Deschide toate
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={openCount === 0}
            className="rounded-lg border border-zinc-700/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Închide toate
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 shadow-sm shadow-black/20">
        <AccordionSection
          sectionId="maintenance"
          title="Mentenanță"
          summary={summaries.maintenance}
          open={open.maintenance}
          onToggle={() => toggle("maintenance")}
          actions={
            <>
              <Link href={`/fleet/maintenance?${regQs}`} className={actionLinkClass}>
                Listă
              </Link>
              {write ? (
                <Link
                  href={`/fleet/maintenance/new?vehicleId=${encodeURIComponent(vehicleId)}`}
                  className={actionPrimaryClass}
                >
                  + Nou
                </Link>
              ) : null}
            </>
          }
        >
          {!maintenance.ok ? (
            <p className="text-sm text-amber-400">Nu am putut încărca mentenanța.</p>
          ) : (
            <VehicleMaintenancePanel
              items={maintenance.items}
              totalInDb={maintenance.total}
              regQs={regQs}
            />
          )}
        </AccordionSection>

        <AccordionSection
          sectionId="costs"
          title="Costuri"
          summary={summaries.costs}
          open={open.costs}
          onToggle={() => toggle("costs")}
          actions={
            <>
              <Link href={`/fleet/costs?${regQs}`} className={actionLinkClass}>
                Listă
              </Link>
              {write ? (
                <Link
                  href={`/fleet/costs/new?vehicleId=${encodeURIComponent(vehicleId)}`}
                  className={actionPrimaryClass}
                >
                  + Nou
                </Link>
              ) : null}
            </>
          }
        >
          {!costs.ok ? (
            <p className="text-sm text-amber-400">Nu am putut încărca costurile.</p>
          ) : (
            <VehicleCostsPanel items={costs.items} totalInDb={costs.total} regQs={regQs} />
          )}
        </AccordionSection>

        <AccordionSection
          sectionId="documents"
          title="Documente"
          summary={summaries.documents}
          open={open.documents}
          onToggle={() => toggle("documents")}
          actions={
            <>
              <Link href={`/fleet/documents?${regQs}`} className={actionLinkClass}>
                Listă
              </Link>
              {write ? (
                <Link
                  href={`/fleet/documents/new?vehicleId=${encodeURIComponent(vehicleId)}`}
                  className={actionPrimaryClass}
                >
                  + Nou
                </Link>
              ) : null}
            </>
          }
        >
          {!documents.ok ? (
            <p className="text-sm text-amber-400">Nu am putut încărca documentele.</p>
          ) : (
            <VehicleDocumentsPanel items={documents.items} totalInDb={documents.total} regQs={regQs} />
          )}
        </AccordionSection>

        <AccordionSection
          sectionId="reminders"
          title="Remindere"
          summary={summaries.reminders}
          open={open.reminders}
          onToggle={() => toggle("reminders")}
          actions={
            <>
              <Link href={`/fleet/reminders?registrationNumber=${encodeURIComponent(registrationNumber)}`} className={actionLinkClass}>
                Listă
              </Link>
              {write ? (
                <Link
                  href={`/fleet/reminders/new?vehicleId=${encodeURIComponent(vehicleId)}`}
                  className="rounded-md border border-fuchsia-800/60 bg-fuchsia-600/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-fuchsia-500"
                >
                  + Nou
                </Link>
              ) : null}
            </>
          }
        >
          <div id="reminders">
            <VehicleRemindersSection
              vehicleId={vehicleId}
              registrationNumber={registrationNumber}
              write={write}
            />
          </div>
        </AccordionSection>

        <AccordionSection
          sectionId="mobility"
          title="Rulaj vs Consum"
          summary={summaries.mobility}
          open={open.mobility}
          onToggle={() => toggle("mobility")}
          actions={
            <>
              <Link href={`/fleet/trips?${regQs}`} className={actionLinkClass}>
                Curse
              </Link>
              {write ? (
                <Link
                  href={`/fleet/costs/new?vehicleId=${encodeURIComponent(vehicleId)}&category=${encodeURIComponent("Combustibil")}`}
                  className="rounded-md border border-amber-800/60 bg-amber-600/90 px-2.5 py-1 text-[11px] font-medium text-zinc-950 hover:bg-amber-500"
                >
                  + Alimentare
                </Link>
              ) : null}
            </>
          }
        >
          {!mobility.ok ? (
            <p className="text-sm text-amber-400">Nu am putut încărca datele de rulaj și consum.</p>
          ) : (
            <VehicleMobilityPanel data={mobility.data} vehicleId={vehicleId} regQs={regQs} />
          )}
        </AccordionSection>
      </div>
    </section>
  );
}
