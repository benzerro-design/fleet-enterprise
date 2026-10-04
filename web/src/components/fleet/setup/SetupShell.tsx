"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SETUP_PILLARS,
  isSetupPillarActive,
  type SetupPillar,
} from "@/lib/setup-pillars";
import { useT } from "@/lib/i18n/useT";

type SetupShellProps = {
  children: React.ReactNode;
  /** Titlu pagină (pilon sau HEAD). */
  title: string;
  /** O singură propoziție de context. */
  description?: string;
  /** Acțiuni opționale în dreapta headerului. */
  actions?: React.ReactNode;
};

function PillarNavItem({
  pillar,
  pathname,
  tx,
}: {
  pillar: SetupPillar;
  pathname: string;
  tx: (key: string) => string;
}) {
  const active = isSetupPillarActive(pathname, pillar);
  const base =
    "group flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors";
  const label = tx(`pages.setup.pillars.${pillar.id}.label`);
  const blurb = tx(`pages.setup.pillars.${pillar.id}.blurb`);

  if (pillar.status === "soon" || !pillar.href) {
    return (
      <div className={`${base} cursor-default opacity-55`} aria-disabled>
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm text-zinc-500">{label}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            {tx("pages.setup.soon")}
          </span>
        </span>
      </div>
    );
  }

  return (
    <Link
      href={pillar.href}
      className={`${base} ${
        active
          ? "bg-[var(--fleet-surface-solid)] text-zinc-100 ring-1 ring-[var(--fleet-surface-border)]"
          : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span className="text-sm font-medium">{label}</span>
      {active ? (
        <span className="text-[11px] leading-snug text-zinc-500">{blurb}</span>
      ) : null}
    </Link>
  );
}

/**
 * Layout comun Setup — rail piloni + conținut aerisit.
 * Doar L* (paginile părinte fac redirect dacă nu e admin).
 */
export function SetupShell({ children, title, description, actions }: SetupShellProps) {
  const tx = useT();
  const pathname = usePathname() ?? "";
  const isHead = pathname === "/fleet/setup" || pathname === "/fleet/setup/";

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-10">
      <aside className="mb-6 shrink-0 border-b border-zinc-800/80 pb-4 lg:mb-0 lg:w-56 lg:border-b-0 lg:border-r lg:border-zinc-800/80 lg:pb-0 lg:pr-6">
        <div className="mb-4">
          <Link
            href="/fleet/setup"
            className={`text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              isHead ? "text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tx("pages.setup.eyebrow")}
          </Link>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            {tx("pages.setup.shellDescription")}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label={tx("pages.setup.navAria")}>
          {SETUP_PILLARS.map((pillar) => (
            <div key={pillar.id} className="min-w-[9.5rem] shrink-0 lg:min-w-0">
              <PillarNavItem pillar={pillar} pathname={pathname} tx={tx} />
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-8 max-w-3xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[1.75rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </header>
        <div className="min-w-0 max-w-4xl flex-1">{children}</div>
      </div>
    </div>
  );
}
