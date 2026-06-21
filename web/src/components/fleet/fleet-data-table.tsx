import type { ReactNode } from "react";

/** ~15% mai compact decât px-4 py-3; folosit pe toate listele tabel. */
export const fleetThClass =
  "sticky top-0 z-10 bg-zinc-950 px-3 py-2.5 text-left shadow-[inset_0_-1px_0_0_rgb(39_39_42)]";
export const fleetThRightClass = `${fleetThClass} text-right`;
export const fleetTdClass = "px-3 py-2.5";
export const fleetTableClass = "min-w-full text-left text-sm leading-tight";
export const fleetTheadClass = "text-xs uppercase text-zinc-500";

type FleetDataTableProps = {
  children: ReactNode;
  className?: string;
};

/** Container cu scroll vertical; antetul rămâne sticky în interior. */
export function FleetDataTable({ children, className = "" }: FleetDataTableProps) {
  return (
    <div
      className={`max-h-[min(70vh,calc(100dvh-14rem))] overflow-auto rounded-lg border border-zinc-800 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
