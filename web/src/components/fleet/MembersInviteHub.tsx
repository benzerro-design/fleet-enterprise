"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";

export const MEMBERS_HUB_TABS = [
  { id: "abonat", label: "Abonat" },
  { id: "client", label: "Client" },
  { id: "furnizor", label: "Furnizor" },
] as const;

export type MembersHubTabId = (typeof MEMBERS_HUB_TABS)[number]["id"];

export function parseMembersHubTab(raw?: string | null): MembersHubTabId {
  if (raw === "client" || raw === "furnizor" || raw === "abonat") return raw;
  return "abonat";
}

type Props = {
  active: MembersHubTabId;
  children: ReactNode;
};

export function MembersInviteHub({ active, children }: Props) {
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-zinc-800">
        {MEMBERS_HUB_TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "abonat" ? "/fleet/members" : `/fleet/members?tab=${t.id}`}
            className={fleetSheetTabClass(active === t.id)}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
