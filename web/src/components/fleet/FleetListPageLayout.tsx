"use client";

import type { ReactNode } from "react";
import { FleetListDisplayScope } from "@/components/fleet/FleetListDisplayScope";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";

type FleetListPageLayoutProps = {
  /** Titlu, acțiuni, tab-uri — fixe, fără scroll. */
  header?: ReactNode;
  /** Formular filtre — fix sub header. */
  filters?: ReactNode;
  /** Tab-uri secundare, acțiuni rapide — fix sub filtre (ex. status remindere). */
  toolbar?: ReactNode;
  /** Listă, paginare — scroll pe întreaga zonă; antetul tabelului rămâne sticky aici. */
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
 * Layout listă operațională: header + filtre fixe; lista scroll-ează dedesubt.
 * PLAT-007: un singur surface pe listă (fără sticky/blur pe filtre — evita frameuri intercalate).
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

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: "var(--fleet-gap)" }}>
      {header ? <div className="shrink-0 space-y-3">{header}</div> : null}
      {filters ? <div className="shrink-0">{filters}</div> : null}
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div className={`${fleetScrollPaneClass} flex min-h-0 flex-1 flex-col`}>
        {listSurface ? (
          <div
            className="fleet-surface-solid flex min-h-0 flex-1 flex-col p-3 sm:p-4"
            style={{ gap: "calc(var(--fleet-gap) * 0.75)" }}
          >
            {listBody}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col" style={{ gap: "calc(var(--fleet-gap) * 0.75)" }}>
            {listBody}
          </div>
        )}
      </div>
    </div>
  );
}
