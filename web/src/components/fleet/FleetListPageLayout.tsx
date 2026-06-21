import type { ReactNode } from "react";

type FleetListPageLayoutProps = {
  /** Titlu, acțiuni, tab-uri — fixe, fără scroll. */
  header?: ReactNode;
  /** Formular filtre — fix sub header. */
  filters?: ReactNode;
  /** Listă, paginare — scroll pe întreaga zonă; antetul tabelului rămâne sticky aici. */
  children: ReactNode;
};

/**
 * Layout listă operațională: filtre vizibile permanent, conținutul de dedesubt scroll-ează ca un bloc.
 */
export function FleetListPageLayout({ header, filters, children }: FleetListPageLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {header ? <div className="shrink-0 space-y-6">{header}</div> : null}
      {filters ? <div className="shrink-0">{filters}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto overscroll-y-contain">
        <div className="flex flex-col gap-4 pb-1">{children}</div>
      </div>
    </div>
  );
}
