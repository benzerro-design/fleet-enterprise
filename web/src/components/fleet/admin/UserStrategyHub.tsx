"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";
import {
  USER_STRATEGY_TABS,
  type UserStrategyTabId,
} from "@/lib/user-strategy-tabs";

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
