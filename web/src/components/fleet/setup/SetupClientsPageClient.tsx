"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClientNotificationSettingsEditor } from "@/components/fleet/setup/ClientNotificationSettingsEditor";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { SlaSettingsEditor } from "@/components/fleet/setup/SlaSettingsEditor";
import { TenantServiceTypesEditor } from "@/components/fleet/setup/TenantServiceTypesEditor";
import type { TenantServiceType } from "@/lib/tenant-service-types/types";

type ClientTab = "tip-servicii" | "sla" | "notifications";

const TABS: { id: ClientTab; label: string; live: boolean }[] = [
  { id: "tip-servicii", label: "Catalog tipuri", live: true },
  { id: "sla", label: "SLA & priorități", live: true },
  { id: "notifications", label: "Notificări", live: true },
];

type Props = {
  initialItems: TenantServiceType[];
};

/**
 * SETUP-012 / SETUP-004 / SETUP-006: catalog + SLA + notificări pe tenant.
 * Politici pe client → fișa Clientului (nu aici).
 */
export function SetupClientsPageClient({ initialItems }: Props) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const cameFromPolicies = rawTab === "forms";
  const requested = TABS.find((t) => t.id === rawTab);
  const activeTab: ClientTab = requested?.live ? requested.id : "tip-servicii";

  const title =
    activeTab === "sla"
      ? "SLA & priorități"
      : activeTab === "notifications"
        ? "Notificări"
        : "Tipuri & servicii";
  const description =
    activeTab === "sla"
      ? "Termene de răspuns și rezolvare pe prioritate, plus maparea tip tichet → prioritate — pentru tot abonatul."
      : activeTab === "notifications"
        ? "Când se trimite email pe evenimente CRM și către ce roluri — pe tot abonatul. SMTP rămâne în Setup → Email."
        : "Catalog tenant — etichete și descrieri pentru portalul client. Furnizorii bifează din acest catalog ce prestează.";

  return (
    <SetupShell title={title} description={description}>
      {cameFromPolicies ? (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-relaxed text-zinc-400">
          Politicile pe client (programări, listă tichete, drepturi L1) nu se mai editează din Setup. Deschide{" "}
          <Link href="/fleet/clients" className="font-medium text-zinc-200 underline-offset-2 hover:underline">
            fișa clientului → Drepturi & politici L1
          </Link>
          .
        </div>
      ) : null}

      <div className="mb-8 flex flex-wrap gap-2 border-b border-zinc-800/80 pb-3">
        {TABS.map((tb) => (
          <Link
            key={tb.id}
            href={`/fleet/setup/clients?tab=${tb.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activeTab === tb.id
                ? "bg-[var(--fleet-surface-solid)] font-medium text-zinc-100 ring-1 ring-[var(--fleet-surface-border)]"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            {tb.label}
          </Link>
        ))}
      </div>

      {activeTab === "tip-servicii" ? <TenantServiceTypesEditor initialItems={initialItems} /> : null}
      {activeTab === "sla" ? <SlaSettingsEditor /> : null}
      {activeTab === "notifications" ? <ClientNotificationSettingsEditor /> : null}
    </SetupShell>
  );
}
