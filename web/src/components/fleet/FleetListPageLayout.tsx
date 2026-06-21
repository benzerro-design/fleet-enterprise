import type { ReactNode } from "react";
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
};

/**
 * Layout listă operațională: filtre vizibile permanent, conținutul de dedesubt scroll-ează ca un bloc.
 */
export function FleetListPageLayout({ header, filters, toolbar, children }: FleetListPageLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {header ? <div className="shrink-0 space-y-3">{header}</div> : null}
      {filters ? <div className="shrink-0">{filters}</div> : null}
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div className={`${fleetScrollPaneClass} flex min-h-0 flex-1 flex-col`}>
        <div className="flex flex-col gap-4 pb-1">{children}</div>
      </div>
    </div>
  );
}
