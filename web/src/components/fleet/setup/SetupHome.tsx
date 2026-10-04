"use client";

import Link from "next/link";
import { SETUP_PILLARS } from "@/lib/setup-pillars";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { useT } from "@/lib/i18n/useT";

export function SetupHome() {
  const tx = useT();
  const live = SETUP_PILLARS.filter((p) => p.status === "live");
  const soon = SETUP_PILLARS.filter((p) => p.status === "soon");
  const pillarLabel = (id: string) => tx(`pages.setup.pillars.${id}.label`);
  const pillarBlurb = (id: string) => tx(`pages.setup.pillars.${id}.blurb`);

  return (
    <SetupShell
      title={tx("pages.setup.title")}
      description={tx("pages.setup.description")}
    >
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{tx("pages.setup.available")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {live.map((pillar) => (
            <li key={pillar.id}>
              <Link
                href={pillar.href!}
                className="fleet-surface group flex h-full flex-col gap-3 p-5 transition-colors hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-base font-medium text-zinc-100 group-hover:text-white">
                    {pillarLabel(pillar.id)}
                  </span>
                  <span className="mt-0.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400">
                    →
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-500">{pillarBlurb(pillar.id)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {soon.length > 0 ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{tx("pages.setup.comingSoon")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {soon.map((pillar) => (
              <li
                key={pillar.id}
                className="rounded-xl border border-dashed border-zinc-800 bg-transparent p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-base font-medium text-zinc-400">{pillarLabel(pillar.id)}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    {tx("pages.setup.soon")}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{pillarBlurb(pillar.id)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-12 max-w-xl text-xs leading-relaxed text-zinc-600">
        {tx("pages.setup.clientPoliciesPrefix")}{" "}
        <Link href="/fleet/clients" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
          {tx("pages.setup.clientPoliciesLink")}
        </Link>
        .
      </p>
    </SetupShell>
  );
}
