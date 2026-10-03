"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { TenantServiceTypesEditor } from "@/components/fleet/setup/TenantServiceTypesEditor";
import type { TenantServiceType } from "@/lib/tenant-service-types/types";

type Props = {
  initialItems: TenantServiceType[];
};

/**
 * SETUP-012: pilon Tipuri & servicii = catalog tenant.
 * Politici pe client (fost „Politici tichet”) → doar pe fișa Clientului.
 */
export function SetupClientsPageClient({ initialItems }: Props) {
  const searchParams = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const cameFromPolicies = legacyTab === "forms";

  return (
    <SetupShell
      title="Tipuri & servicii"
      description="Catalog tenant — etichete și descrieri pentru portalul client. Furnizorii bifează din acest catalog ce prestează."
    >
      {cameFromPolicies ? (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-relaxed text-zinc-400">
          Politicile pe client (programări, listă tichete, drepturi L1) nu se mai editează din Setup. Deschide{" "}
          <Link href="/fleet/clients" className="font-medium text-zinc-200 underline-offset-2 hover:underline">
            fișa clientului → Drepturi & politici L1
          </Link>
          .
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800/80 pb-3">
        <span className="rounded-lg bg-[var(--fleet-surface-solid)] px-3 py-1.5 text-sm font-medium text-zinc-100 ring-1 ring-[var(--fleet-surface-border)]">
          Catalog tipuri
        </span>
        <span
          className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm text-zinc-600"
          title="Șabloane SLA pe tenant — după organizarea Setup"
        >
          SLA & priorități · curând
        </span>
        <span
          className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm text-zinc-600"
          title="Planificat"
        >
          Notificări · curând
        </span>
      </div>

      <TenantServiceTypesEditor initialItems={initialItems} />
    </SetupShell>
  );
}
