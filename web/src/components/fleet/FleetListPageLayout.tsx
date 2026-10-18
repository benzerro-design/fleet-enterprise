"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { FleetListDisplayScope } from "@/components/fleet/FleetListDisplayScope";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";
import { useT } from "@/lib/i18n/useT";

type FleetListPageLayoutProps = {
  /** Titlu, acțiuni, tab-uri — fixe, fără scroll. */
  header?: ReactNode;
  /** Formular filtre — pe desktop vizibil; pe mobil colapsat (toggle). */
  filters?: ReactNode;
  /** Tab-uri secundare, acțiuni rapide — fix sub filtre (ex. status remindere). */
  toolbar?: ReactNode;
  /** Listă, paginare — scroll pe zona interioară (fără radius pe containerul care scroll-ează). */
  children: ReactNode;
  /**
   * PLAT-007 / FLEET-028: toolbar densitate (Detaliat / Simplu) pe lista din children.
   * False pe portal partener (shell partener neschimbat) sau embed-uri.
   */
  densityToolbar?: boolean;
  /** Card surface în jurul listei (false când children e deja un panou full — ex. programator). */
  listSurface?: boolean;
};

/**
 * Filtre pe mobil: închise implicit + max-height redusă cu scroll intern când sunt deschise,
 * ca lista să rămână vizibilă. Pe lg+ rămân mereu vizibile (comportament desktop).
 */
function FleetListFiltersSlot({ children }: { children: ReactNode }) {
  const tx = useT();
  const pathname = usePathname() ?? "";
  const search = useSearchParams()?.toString() ?? "";
  const panelId = useId();
  const [open, setOpen] = useState(false);

  // După navigare / aplicare filtre, închide panoul pe mobil ca lista să redevină vizibilă.
  useEffect(() => {
    setOpen(false);
  }, [pathname, search]);

  return (
    <div className="shrink-0">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          className="inline-flex min-h-[40px] flex-1 touch-manipulation items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-900"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{tx("common.list.filters")}</span>
          <span className="text-xs font-normal text-zinc-400">
            {open ? tx("common.list.hideFilters") : tx("common.list.showFilters")}
          </span>
        </button>
      </div>
      <div
        id={panelId}
        className={`${open ? "mt-1.5 block" : "hidden"} max-h-[min(28vh,12rem)] overflow-y-auto overscroll-contain rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2 lg:mt-0 lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Layout listă: header/filtre fixe; surface cu radius pe exterior;
 * scroll DOAR pe interiorul fără border-radius (evită ghost/frame intercalat Chrome
 * când sticky/overflow/radius stau pe același stacking context).
 */
export function FleetListPageLayout({
  header,
  filters,
  toolbar,
  children,
  densityToolbar = true,
  listSurface = true,
}: FleetListPageLayoutProps) {
  const listBody = (
    <FleetListDisplayScope hideToolbar={!densityToolbar}>{children}</FleetListDisplayScope>
  );

  const scrollBody = (
    <div className={`${fleetScrollPaneClass} min-h-0 flex-1`}>{listBody}</div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: "var(--fleet-gap)" }}>
      {header ? <div className="shrink-0 space-y-3">{header}</div> : null}
      {filters ? <FleetListFiltersSlot>{filters}</FleetListFiltersSlot> : null}
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      {listSurface ? (
        <div
          className="fleet-surface-solid flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4"
          style={{ gap: "calc(var(--fleet-gap) * 0.75)" }}
        >
          {scrollBody}
        </div>
      ) : (
        scrollBody
      )}
    </div>
  );
}
