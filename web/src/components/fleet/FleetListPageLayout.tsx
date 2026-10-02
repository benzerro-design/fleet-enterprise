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
      {filters ? <div className="shrink-0">{filters}</div> : null}
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
