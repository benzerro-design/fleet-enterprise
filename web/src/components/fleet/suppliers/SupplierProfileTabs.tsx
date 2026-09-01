"use client";

import { useState } from "react";
import { SupplierServicesEditor } from "@/components/fleet/SupplierServicesEditor";
import { SupplierClientAllocationsEditor } from "@/components/fleet/suppliers/SupplierClientAllocationsEditor";
import type { SupplierMembershipMe } from "@/lib/auth-server";
import type { SupplierRecord } from "@/lib/suppliers-api";
import type { SupplierServiceCatalogEntry } from "@/lib/supplier-service-catalog";
import { supplierCategoryLabel, supplierStatusLabel } from "@/lib/suppliers-api";

export const SUPPLIER_PROFILE_TABS = [
  { id: "identitate", label: "Identitate & contact" },
  { id: "tip", label: "Tip & servicii" },
  { id: "tarife", label: "Tarife & prețuri" },
  { id: "documente", label: "Documente firmă" },
  { id: "program", label: "Program & locații" },
  { id: "echipa", label: "Echipă" },
  { id: "clienti", label: "Clienți alocați" },
] as const;

export type SupplierProfileTabId = (typeof SUPPLIER_PROFILE_TABS)[number]["id"];

type Props = {
  supplier: SupplierRecord | null;
  serviceCatalog: SupplierServiceCatalogEntry[];
  tenantSlug?: string;
  supplierMembership?: SupplierMembershipMe;
  canWriteServices?: boolean;
  canAllocateClients?: boolean;
  assignedByLabel?: string;
  contextLabel?: string;
};

export function SupplierProfileTabs({
  supplier,
  serviceCatalog,
  tenantSlug,
  supplierMembership,
  canWriteServices = false,
  canAllocateClients = false,
  assignedByLabel = "Flotă",
  contextLabel,
}: Props) {
  const [tab, setTab] = useState<SupplierProfileTabId>("identitate");
  const tabs = canAllocateClients
    ? SUPPLIER_PROFILE_TABS
    : SUPPLIER_PROFILE_TABS.filter((t) => t.id !== "clienti");

  return (
    <>
      {contextLabel ? (
        <p className="mb-4 text-sm text-zinc-400">{contextLabel}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {tabs.map((t) => (
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
              <dt className="text-xs text-zinc-500">Categorie</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier ? supplierCategoryLabel(supplier.category) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Status</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier ? supplierStatusLabel(supplier.status) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">CUI</dt>
              <dd className="mt-1 font-mono text-sm text-zinc-200">{supplier?.taxId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Comenzi service</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplier?.workOrderCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Email contact</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplier?.contactEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Telefon</dt>
              <dd className="mt-1 text-sm text-zinc-200">{supplier?.contactPhone ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">Adresă</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {[supplier?.addressLine, supplier?.city, supplier?.county].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            {supplierMembership ? (
              <div>
                <dt className="text-xs text-zinc-500">Rol cont portal</dt>
                <dd className="mt-1 text-sm text-zinc-200">{supplierMembership.role}</dd>
              </div>
            ) : null}
            {tenantSlug ? (
              <div>
                <dt className="text-xs text-zinc-500">Tenant</dt>
                <dd className="mt-1 font-mono text-sm text-zinc-200">{tenantSlug}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {tab === "tip" && supplier ? (
          <SupplierServicesEditor
            supplierId={supplier.id}
            catalog={serviceCatalog}
            initialSelected={supplier.services ?? []}
            canWrite={canWriteServices}
            assignedByLabel={assignedByLabel}
          />
        ) : null}

        {tab === "tip" && !supplier ? (
          <p className="text-sm text-zinc-500">Nu am putut încărca profilul furnizorului.</p>
        ) : null}

        {tab === "clienti" && supplier ? <SupplierClientAllocationsEditor supplierId={supplier.id} /> : null}

        {tab === "clienti" && !supplier ? (
          <p className="text-sm text-zinc-500">Nu am putut încărca profilul furnizorului.</p>
        ) : null}

        {tab === "documente" ? (
          <div className="space-y-3 text-sm text-zinc-400">
            <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-amber-200">
              Autorizație ITP — expiră curând (indicator în header portal).
            </p>
            <p>Upload și gestionare documente — modul P2 (în curând).</p>
          </div>
        ) : null}

        {tab === "tarife" ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Discount piese</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier ? `${supplier.partsDiscountPercent ?? 0}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Discount manoperă</dt>
              <dd className="mt-1 text-sm text-zinc-200">
                {supplier ? `${supplier.laborDiscountPercent ?? 0}%` : "—"}
              </dd>
            </div>
            <p className="sm:col-span-2 text-xs text-zinc-500">
              Default pe linii noi de deviz (piese / manoperă). Se poate modifica per linie pe comandă.
              Valorile se editează din fișa furnizorului (admin flotă).
            </p>
          </dl>
        ) : null}

        {tab !== "identitate" &&
        tab !== "documente" &&
        tab !== "tip" &&
        tab !== "clienti" &&
        tab !== "tarife" ? (
          <p className="text-sm text-zinc-500">
            Conținut tab „{SUPPLIER_PROFILE_TABS.find((t) => t.id === tab)?.label}” — urmează în faza P2 profil furnizor.
          </p>
        ) : null}
      </div>
    </>
  );
}
