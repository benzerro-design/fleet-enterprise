type FleetPageMainProps = {
  children: React.ReactNode;
  className?: string;
  /** Narrow forms (members, reminder detail) stay readable on wide layouts. */
  narrow?: "sm" | "md";
  /** Pagini listă: umple înălțimea disponibilă; scroll-ul e delegat layout-ului de listă. */
  fill?: boolean;
};

export function FleetPageMain({ children, className, narrow, fill }: FleetPageMainProps) {
  const narrowClass = narrow === "sm" ? "max-w-3xl" : narrow === "md" ? "max-w-4xl" : "";
  const mainClass = [
    "flex w-full flex-col gap-8",
    narrowClass,
    fill ? "min-h-0 flex-1" : "min-h-0 flex-1 overflow-auto",
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
