"use client";

import { useState } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import type { SupplierMembershipMe } from "@/lib/auth-server";

const PROFILE_TABS = [
  { id: "identitate", label: "Identitate & contact" },
  { id: "tip", label: "Tip & servicii" },
  { id: "tarife", label: "Tarife & prețuri" },
  { id: "documente", label: "Documente firmă" },
  { id: "program", label: "Program & locații" },
  { id: "echipa", label: "Echipă" },
] as const;

type TabId = (typeof PROFILE_TABS)[number]["id"];

type Props = {
  supplier?: SupplierMembershipMe;
  tenantSlug: string;
};

export function PartnerProfileClient({ supplier, tenantSlug }: Props) {
  const [tab, setTab] = useState<TabId>("identitate");

  return (
    <FleetPageMain>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Portal partener</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Profil firmă</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {supplier?.supplierLegalName ?? "Furnizor"} · {supplier?.supplierCode ?? "—"} · tenant {tenantSlug}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {PROFILE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              tab === t.id
                ? "bg-violet-600 text-white"
                : "border border-zinc-700 text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
        {tab === "identitate" ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Denumire legală</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplier?.supplierLegalName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Cod furnizor</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-200">{supplier?.supplierCode ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Rol cont</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplier?.role ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Tenant</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-200">{tenantSlug}</dd>
            </div>
          </dl>
        ) : null}

        {tab === "documente" ? (
          <div className="space-y-3 text-sm text-zinc-400">
            <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-amber-200">
              Autorizație ITP — expiră curând (indicator în header).
            </p>
            <p>Upload și gestionare documente — modul P2 (în curând).</p>
          </div>
        ) : null}

        {tab !== "identitate" && tab !== "documente" ? (
          <p className="text-sm text-zinc-500">
            Conținut tab „{PROFILE_TABS.find((t) => t.id === tab)?.label}” — urmează în faza P2 profil furnizor.
          </p>
        ) : null}
      </div>
    </FleetPageMain>
  );
}
