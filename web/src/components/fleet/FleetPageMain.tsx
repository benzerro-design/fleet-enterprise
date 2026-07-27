import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";

type FleetPageMainProps = {
  children: React.ReactNode;
  className?: string;
  /** Narrow forms (members, reminder detail) stay readable on wide layouts. */
  narrow?: "sm" | "md";
  /**
   * Pagini listă: umple înălțimea; scroll-ul e pe layout-ul de listă (nu pe main),
   * ca să nu apară fereastră-în-fereastră.
   */
  fill?: boolean;
};

export function FleetPageMain({ children, className, narrow, fill }: FleetPageMainProps) {
  const narrowClass = narrow === "sm" ? "max-w-3xl" : narrow === "md" ? "max-w-4xl" : "";
  const mainClass = [
    "flex w-full flex-col gap-6",
    narrowClass,
    // Un singur scroll pe paginile de detaliu; pe fill (liste) scroll-ul e în layout-ul copil.
    fill ? "min-h-0 flex-1" : `min-h-0 flex-1 ${fleetScrollPaneClass}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex min-h-0 flex-1 flex-col text-zinc-100">
      <main className={mainClass}>{children}</main>
    </div>
  );
}
