type FleetPageMainProps = {
  children: React.ReactNode;
  className?: string;
  /** Narrow forms (members, reminder detail) stay readable on wide layouts. */
  narrow?: "sm" | "md";
};

export function FleetPageMain({ children, className, narrow }: FleetPageMainProps) {
  const narrowClass = narrow === "sm" ? "max-w-3xl" : narrow === "md" ? "max-w-4xl" : "";
  const mainClass = ["flex w-full flex-col gap-8", narrowClass, className].filter(Boolean).join(" ");
  return (
    <div className="w-full text-zinc-100">
      <main className={mainClass}>{children}</main>
    </div>
  );
}
