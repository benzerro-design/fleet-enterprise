import type { ReactNode } from "react";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";

/**
 * Antet tabel — fără position:sticky.
 * Sticky + overflow + border-radius pe stack creează frameuri „fantomă” în Chrome.
 */
export const fleetThClass = "bg-zinc-950 px-3 py-2 text-left border-b border-zinc-800";
export const fleetThRightClass = `${fleetThClass} text-right`;
export const fleetTdClass = "px-3 py-2";
export const fleetTableClass =
  "min-w-full border-separate border-spacing-0 text-left text-sm leading-tight";
export const fleetTheadClass = "text-xs uppercase text-zinc-500";

type FleetDataTableProps = {
  children: ReactNode;
  className?: string;
  /** Panouri în secțiuni — scroll intern (fără sticky th). */
  contained?: boolean;
};

/**
 * Scroll orizontal pe tabele late.
 * Fără border/radius pe lista principală — surface-ul din layout e singurul frame.
 */
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

  return <div className={`min-w-0 overflow-x-auto ${className}`.trim()}>{children}</div>;
}
