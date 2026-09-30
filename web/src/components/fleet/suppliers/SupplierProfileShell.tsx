"use client";

import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SupplierProfileTabs } from "@/components/fleet/suppliers/SupplierProfileTabs";
import type { SupplierMembershipMe } from "@/lib/auth-server";
import { supplierCategoryLabel, supplierStatusLabel, type SupplierRecord } from "@/lib/suppliers-api";
import type { SupplierServiceCatalogEntry } from "@/lib/supplier-service-catalog";

export type SupplierProfileShellMode = "fleet" | "partner";

type TabsProps = {
  supplier: SupplierRecord | null;
  serviceCatalog: SupplierServiceCatalogEntry[];
  tenantSlug?: string;
  supplierMembership?: SupplierMembershipMe;
  canWriteServices?: boolean;
  canAllocateClients?: boolean;
  canInviteTeam?: boolean;
  allowManagerInvite?: boolean;
  assignedByLabel?: string;
  contextLabel?: string;
};

type FleetModeProps = TabsProps & {
  mode: "fleet";
  supplier: SupplierRecord;
  canEdit?: boolean;
};

type PartnerModeProps = TabsProps & {
  mode: "partner";
  tenantSlug: string;
};

export type SupplierProfileShellProps = FleetModeProps | PartnerModeProps;

export function SupplierProfileShell(props: SupplierProfileShellProps) {
  const tabsProps: TabsProps = {
    supplier: props.supplier,
    serviceCatalog: props.serviceCatalog,
    tenantSlug: props.tenantSlug,
    supplierMembership: props.supplierMembership,
    canWriteServices: props.canWriteServices,
    canAllocateClients: props.canAllocateClients,
    canInviteTeam: props.canInviteTeam,
    allowManagerInvite: props.allowManagerInvite,
    assignedByLabel: props.assignedByLabel,
    contextLabel: props.contextLabel,
  };

  return (
    <FleetPageMain>
      {props.mode === "fleet" ? (
        <>
          <Link href="/fleet/suppliers" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Furnizori
          </Link>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm text-sky-400">{props.supplier.code}</p>
              <h1 className="mt-1 text-3xl font-semibold">{props.supplier.legalName}</h1>
              <p className="mt-2 text-sm text-zinc-400">
                {supplierCategoryLabel(props.supplier.category)} · {supplierStatusLabel(props.supplier.status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/fleet/partner?supplierId=${props.supplier.id}`}
                className="rounded-lg border border-violet-800/50 px-4 py-2 text-sm text-violet-300 hover:bg-violet-950/30"
              >
                Portal view-as
              </Link>
              {props.canEdit ? (
                <Link
                  href={`/fleet/suppliers/${props.supplier.id}/edit`}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  Editare
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Portal partener</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Profil firmă</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {props.supplier?.legalName ?? props.supplierMembership?.supplierLegalName ?? "Furnizor"} ·{" "}
            {props.supplier?.code ?? props.supplierMembership?.supplierCode ?? "—"} · tenant {props.tenantSlug}
          </p>
        </div>
      )}

      <div className={props.mode === "fleet" ? "mt-8" : "mt-6"}>
        <SupplierProfileTabs {...tabsProps} />
      </div>
    </FleetPageMain>
  );
}
