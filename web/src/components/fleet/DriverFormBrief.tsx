"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FleetAvatar } from "@/components/fleet/tickets/TicketListGlyphs";
import type { DriverRecord } from "@/lib/drivers-api";
import { driversBrowserBase } from "@/lib/drivers-api";

type BriefSectionProps = {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function BriefSection({ title, count, children, defaultOpen = false }: BriefSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-900/50"
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-zinc-500">
          {count != null ? <span className="font-mono text-[10px]">{count}</span> : null}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>
      {open ? <div className="border-t border-zinc-800 px-3 py-2">{children}</div> : null}
    </div>
  );
}

type Props = {
  mode: "create" | "edit" | "view";
  driver?: DriverRecord | null;
  clientCode?: string;
};

export function DriverFormBrief({ mode, driver, clientCode }: Props) {
  const [recentDrivers, setRecentDrivers] = useState<DriverRecord[]>([]);

  useEffect(() => {
    if (mode !== "create" || !clientCode?.trim()) {
      setRecentDrivers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${driversBrowserBase}?clientId=${encodeURIComponent(clientCode)}&pageSize=5`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: DriverRecord[] };
        if (!cancelled) setRecentDrivers(data.items.slice(0, 5));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, clientCode]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Context șofer</p>
        <p className="mt-1 text-sm text-zinc-400">Activitate și conformitate</p>
      </div>

      {driver ? (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <FleetAvatar name={driver.fullName} size={40} />
          <div>
            <p className="font-medium text-zinc-100">{driver.fullName}</p>
            <p className="text-xs text-zinc-500">{driver.clientCode}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Completează datele șoferului în formular.</p>
      )}

      {mode === "create" && recentDrivers.length > 0 ? (
        <BriefSection title="Șoferi client (recent)" count={recentDrivers.length} defaultOpen>
          <ul className="space-y-2">
            {recentDrivers.map((d) => (
              <li key={d.id}>
                <Link href={`/fleet/drivers/${d.id}`} className="flex items-center gap-2 text-xs hover:text-white">
                  <FleetAvatar name={d.fullName} size={20} />
                  <span className="text-zinc-300">{d.fullName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </BriefSection>
      ) : null}

      {driver ? (
        <>
          <BriefSection title="Vehicule alocate" count={driver.activeVehicleIds?.length ?? 0}>
            {(driver.activeVehicleIds?.length ?? 0) === 0 ? (
              <p className="text-xs text-zinc-500">Niciun vehicul alocat.</p>
            ) : (
              <p className="text-xs text-zinc-400">{driver.activeVehicleIds.length} vehicule active</p>
            )}
          </BriefSection>
          <BriefSection title="Conformitate permis">
            {driver.licenseExpiresOn ? (
              <p className="text-xs text-zinc-400">
                Expiră: {new Date(driver.licenseExpiresOn).toLocaleDateString("ro-RO")}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">Dată expirare necompletată</p>
            )}
          </BriefSection>
          <BriefSection title="Tichete & curse">
            <p className="text-xs text-zinc-500">
              <Link href={`/fleet/drivers/${driver.id}`} className="text-emerald-400 hover:underline">
                Vezi profil complet
              </Link>{" "}
              pentru tichete și curse.
            </p>
          </BriefSection>
        </>
      ) : null}
    </div>
  );
}
