"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";

function PendingSpinner() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0 animate-spin"
    >
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M17 10a7 7 0 00-7-7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FleetPendingLinkInner({
  children,
  pendingLabel,
}: {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return <>{children}</>;
  return (
    <>
      <PendingSpinner />
      <span>{pendingLabel}</span>
    </>
  );
}

type Props = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
  /** Text afișat cât durează navigarea (ex. Se deschide…). */
  pendingLabel?: string;
};

/**
 * Link cu feedback vizibil la click (spinner + label) până se încarcă destinația.
 * Folosit pe CTA-uri tip „Cost nou” / „Cursă nouă” / „Tichet nou”.
 */
export function FleetPendingLink({
  children,
  pendingLabel = "Se deschide…",
  className = "",
  ...rest
}: Props) {
  return (
    <Link {...rest} className={`inline-flex items-center justify-center gap-2 ${className}`}>
      <FleetPendingLinkInner pendingLabel={pendingLabel}>{children}</FleetPendingLinkInner>
    </Link>
  );
}
