import Link from "next/link";
import { Suspense } from "react";
import { ClientProfileTabs } from "@/components/fleet/ClientProfileTabs";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import type { ClientDetailData } from "@/lib/client-detail-server";

type Props = {
  data: ClientDetailData;
  canWrite: boolean;
};

function healthBadgeClass(label: string | undefined): string {
  if (!label || label === "OK") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (label === "ITP") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-rose-500/40 bg-rose-500/10 text-rose-300";
}

export function ClientDetailLayout({ data, canWrite }: Props) {
  const { client } = data;

  return (
    <FleetPageMain>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/fleet/clients" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Clienți
          </Link>
          <p className="mt-4 text-sm font-medium uppercase tracking-widest text-emerald-400">Client 360</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{client.legalName}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span className="font-mono text-zinc-300">{client.code}</span>
            <span className="text-zinc-600">·</span>
            <span className="capitalize">{client.status}</span>
            <span className="text-zinc-600">·</span>
            <span>{client.vehicleCount} vehicule</span>
            {client.healthLabel ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${healthBadgeClass(client.healthLabel)}`}
              >
                {client.healthLabel}
              </span>
            ) : null}
          </p>
        </div>
        {canWrite ? (
          <Link
            href={`/fleet/clients/${client.id}/edit`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Editare client
          </Link>
        ) : null}
      </div>

      <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă profilul client…</p>}>
        <ClientProfileTabs data={data} canWrite={canWrite} />
      </Suspense>
    </FleetPageMain>
  );
}
