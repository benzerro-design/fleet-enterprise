"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";

export const USER_STRATEGY_TABS = [
  { id: "map", label: "Hartă ierarhică", href: "/fleet/user-strategy" },
  { id: "rights", label: "Drepturi F/T/G", href: "/fleet/user-strategy?tab=rights" },
] as const;

export type UserStrategyTabId = (typeof USER_STRATEGY_TABS)[number]["id"];

export function parseUserStrategyTab(raw?: string | null): UserStrategyTabId {
  if (raw === "rights") return "rights";
  return "map";
}

type Props = {
  active: UserStrategyTabId;
  children: ReactNode;
};

export function UserStrategyHub({ active, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-zinc-800">
        {USER_STRATEGY_TABS.map((t) => (
          <Link key={t.id} href={t.href} className={fleetSheetTabClass(active === t.id)}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="mt-6 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
