"use client";

import { useState } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SupplierServicesEditor } from "@/components/fleet/SupplierServicesEditor";
import type { SupplierMembershipMe } from "@/lib/auth-server";
import type { SupplierRecord } from "@/lib/suppliers-api";
import type { SupplierServiceCatalogEntry } from "@/lib/supplier-service-catalog";

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
  supplierMembership?: SupplierMembershipMe;
  supplier: SupplierRecord | null;
  serviceCatalog: SupplierServiceCatalogEntry[];
  tenantSlug: string;
  canWriteServices: boolean;
};

export function PartnerProfileClient({
  supplierMembership,
  supplier,
  serviceCatalog,
  tenantSlug,
  canWriteServices,
}: Props) {
  const [tab, setTab] = useState<TabId>("identitate");

  return (
    <FleetPageMain>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Portal partener</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Profil firmă</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {supplier?.legalName ?? supplierMembership?.supplierLegalName ?? "Furnizor"} ·{" "}
          {supplier?.code ?? supplierMembership?.supplierCode ?? "—"} · tenant {tenantSlug}
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
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier?.legalName ?? supplierMembership?.supplierLegalName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Cod furnizor</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-200">
                {supplier?.code ?? supplierMembership?.supplierCode ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Email contact</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplier?.contactEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Telefon</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplier?.contactPhone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Rol cont</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplierMembership?.role ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Tenant</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-200">{tenantSlug}</dd>
            </div>
          </dl>
        ) : null}

        {tab === "tip" && supplier ? (
          <SupplierServicesEditor
            supplierId={supplier.id}
            catalog={serviceCatalog}
            initialSelected={supplier.services ?? []}
            canWrite={canWriteServices}
            assignedByLabel="Partener / flotă"
          />
        ) : null}

        {tab === "tip" && !supplier ? (
          <p className="text-sm text-zinc-500">Nu am putut încărca profilul furnizorului.</p>
        ) : null}

        {tab === "documente" ? (
          <div className="space-y-3 text-sm text-zinc-400">
            <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-amber-200">
              Autorizație ITP — expiră curând (indicator în header).
            </p>
            <p>Upload și gestionare documente — modul P2 (în curând).</p>
          </div>
        ) : null}

        {tab !== "identitate" && tab !== "documente" && tab !== "tip" ? (
          <p className="text-sm text-zinc-500">
            Conținut tab „{PROFILE_TABS.find((t) => t.id === tab)?.label}” — urmează în faza P2 profil furnizor.
          </p>
        ) : null}
      </div>
    </FleetPageMain>
  );
}
