"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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
  initialTab?: MembersHubTabId;
  abonat: ReactNode;
  client: ReactNode;
  furnizor: ReactNode;
};

export function MembersInviteHub({ initialTab = "abonat", abonat, client, furnizor }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<MembersHubTabId>(initialTab);

  function select(next: MembersHubTabId) {
    setTab(next);
    router.replace(`/fleet/members?tab=${next}`, { scroll: false });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-zinc-800">
        {MEMBERS_HUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            className={fleetSheetTabClass(tab === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "abonat" ? abonat : null}
        {tab === "client" ? client : null}
        {tab === "furnizor" ? furnizor : null}
      </div>
    </div>
  );
}
