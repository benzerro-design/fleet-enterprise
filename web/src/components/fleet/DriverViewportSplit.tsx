import type { ReactNode } from "react";

/** Desktop keeps the fleet desktop chrome; phone keeps the driver card UI. */
export function DriverViewportSplit({
  mobile,
  desktop,
}: {
  mobile: ReactNode;
  desktop: ReactNode;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">{mobile}</div>
      <div className="hidden min-h-0 flex-1 flex-col lg:flex">{desktop}</div>
    </>
  );
}
