"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";

type Mode = "invite" | "create";

type Props = {
  invitePanel: ReactNode;
  createPanel: ReactNode;
  defaultMode?: Mode;
};

/** Zona 1: Invită | Creează user — acțiuni sus, separate de listă. */
export function MembersAddZone({ invitePanel, createPanel, defaultMode = "invite" }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  return (
    <section className="rounded-xl border border-emerald-900/40 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Adaugă membru</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Invită cu link (7 zile) sau creează cont cu parolă acum.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setMode("invite")}
            className={fleetSheetTabClass(mode === "invite")}
          >
            Invită
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={fleetSheetTabClass(mode === "create")}
          >
            Creează user
          </button>
        </div>
      </div>
      <div className="mt-4">{mode === "invite" ? invitePanel : createPanel}</div>
    </section>
  );
}

export function useRefreshAfterMutation() {
  const router = useRouter();
  return () => router.refresh();
}
