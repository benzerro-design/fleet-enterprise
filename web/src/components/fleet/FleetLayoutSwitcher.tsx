"use client";

import { usePathname } from "next/navigation";
import { FleetShell } from "@/components/fleet/FleetShell";
import type { FleetNavGroup } from "@/lib/fleet-nav";

type Props = {
  children: React.ReactNode;
  groups: FleetNavGroup[];
  setup?: FleetNavGroup | null;
  admin: FleetNavGroup | null;
  bot?: FleetNavGroup | null;
  tenantSlug?: string;
  userEmail?: string;
  readOnly?: boolean;
  authBanner?: React.ReactNode;
  homeHref?: string;
};

export function FleetLayoutSwitcher({
  children,
  groups,
  setup,
  admin,
  bot,
  tenantSlug,
  userEmail,
  readOnly,
  authBanner,
  homeHref,
}: Props) {
  const pathname = usePathname() ?? "";
  const isPartnerRoute = pathname === "/fleet/partner" || pathname.startsWith("/fleet/partner/");

  if (isPartnerRoute) {
    return <>{children}</>;
  }

  return (
    <FleetShell
      groups={groups}
      setup={setup}
      admin={admin}
      bot={bot}
      tenantSlug={tenantSlug}
      userEmail={userEmail}
      readOnly={readOnly}
      authBanner={authBanner}
      homeHref={homeHref}
    >
      {children}
    </FleetShell>
  );
}
