import type { ReactNode } from "react";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";

/** ~15–20% mai compact decât px-4 py-3; folosit pe toate listele tabel. */
export const fleetThClass =
  "sticky top-0 z-20 bg-zinc-950 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_rgb(39_39_42)]";
export const fleetThRightClass = `${fleetThClass} text-right`;
export const fleetTdClass = "px-3 py-2";
export const fleetTableClass =
  "min-w-full border-separate border-spacing-0 text-left text-sm leading-tight";
export const fleetTheadClass = "text-xs uppercase text-zinc-500";

type FleetDataTableProps = {
  children: ReactNode;
  className?: string;
  /** Panouri în secțiuni cu overflow:hidden — scroll intern + sticky în cutie. */
  contained?: boolean;
};

/** Border; antet sticky la scroll-ul zonei principale (sau intern dacă `contained`). */
export function FleetDataTable({ children, className = "", contained = false }: FleetDataTableProps) {
  if (contained) {
    return (
      <div
        className={`${fleetScrollPaneClass} max-h-[min(24rem,55vh)] rounded-lg border border-zinc-800 ${className}`.trim()}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-lg border border-zinc-800 ${className}`.trim()}>{children}</div>
  );
}
