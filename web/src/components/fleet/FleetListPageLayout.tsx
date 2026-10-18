"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { FleetListDisplayScope } from "@/components/fleet/FleetListDisplayScope";
import { fleetListFilterToggleClass } from "@/lib/fleet-list-chrome";
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
 * Filtre: pe mobil/tablet închise implicit (buton tool, nu tab).
 * Pe lg+ deschise, dar cu max-height + scroll — lista rămâne vizibilă (documente parcurs etc.).
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
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          className={fleetListFilterToggleClass}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
              <path
                fillRule="evenodd"
                d="M3 4.5A1.5 1.5 0 014.5 3h11A1.5 1.5 0 0117 4.5v.379a1.5 1.5 0 01-.44 1.06l-4.56 4.56v5.001a1 1 0 01-1.447.894l-2-1A1 1 0 018 14.5v-4l-4.56-4.56A1.5 1.5 0 013 4.879V4.5z"
                clipRule="evenodd"
              />
            </svg>
            {tx("common.list.filters")}
          </span>
          <span className="text-xs font-normal text-zinc-500">
            {open ? tx("common.list.hideFilters") : tx("common.list.showFilters")}
          </span>
        </button>
      </div>
      <div
        id={panelId}
        className={`${open ? "mt-1.5 block" : "hidden"} max-h-[min(26vh,11rem)] overflow-y-auto overscroll-contain rounded-md border border-zinc-800/80 bg-zinc-950/50 p-2 lg:mt-0 lg:block lg:max-h-[min(32vh,14rem)] lg:overflow-y-auto`}
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
