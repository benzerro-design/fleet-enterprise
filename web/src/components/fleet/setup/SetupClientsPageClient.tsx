"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TenantServiceTypesEditor } from "@/components/fleet/setup/TenantServiceTypesEditor";
import type { TenantServiceType } from "@/lib/tenant-service-types/types";

type ClientTab = "tip-servicii" | "sla" | "forms" | "notifications";

const TABS: { id: ClientTab; label: string; live: boolean }[] = [
  { id: "tip-servicii", label: "Tip & Servicii", live: true },
  { id: "sla", label: "SLA & priorități", live: false },
  { id: "forms", label: "Formulare tichet", live: false },
  { id: "notifications", label: "Notificări client", live: false },
];

type Props = {
  initialItems: TenantServiceType[];
};

export function SetupClientsPageClient({ initialItems }: Props) {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as ClientTab | null) ?? "tip-servicii";
  const activeTab = TABS.some((t) => t.id === tab) ? tab : "tip-servicii";

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Setup · Clienți</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Configurare experiență client</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Catalog tenant de tipuri service — etichete și descrieri pentru portal client. Furnizorii bifează din
            acest catalog ce prestează.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {TABS.map((tb) =>
          tb.live ? (
            <Link
              key={tb.id}
              href={`/fleet/setup/clients?tab=${tb.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                activeTab === tb.id
                  ? "bg-emerald-600/20 font-medium text-emerald-300 ring-1 ring-emerald-700/50"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {tb.label}
            </Link>
          ) : (
            <span
              key={tb.id}
              className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm text-zinc-600"
              title="Planificat P2"
            >
              {tb.label} · P2
            </span>
          ),
        )}
      </div>

      {activeTab === "tip-servicii" ? <TenantServiceTypesEditor initialItems={initialItems} /> : null}
    </>
  );
}
