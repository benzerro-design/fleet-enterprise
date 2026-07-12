"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { appendPartnerSupplierQuery, parsePartnerSupplierQuery } from "@/lib/partner-context";

export type PartnerSupplierOption = {
  id: string;
  code: string;
  legalName: string;
};

type Props = {
  suppliers: PartnerSupplierOption[];
};

export function PartnerSupplierSelector({ suppliers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = useMemo(
    () => parsePartnerSupplierQuery(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );

  const currentValue = query.suppliers?.length
    ? query.suppliers.join(",")
    : query.supplierId ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const next =
      value === ""
        ? {}
        : value.includes(",")
          ? { suppliers: value.split(",").filter(Boolean) }
          : { supplierId: value };
    router.push(appendPartnerSupplierQuery("/fleet/partner", next));
  }

  if (suppliers.length === 0) return null;

  return (
    <select
      value={currentValue}
      onChange={onChange}
      className="max-w-[12rem] truncate rounded-md border border-amber-800/50 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-100"
      title="Selectează furnizor"
    >
      <option value="">Toți furnizorii</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.code} · {s.legalName}
        </option>
      ))}
    </select>
  );
}

export function PartnerAdminBanner({
  supplierLabel,
  adminEmail,
}: {
  supplierLabel?: string;
  adminEmail?: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-800/40 bg-amber-950/25 px-4 py-1.5 text-[10px] text-amber-200 lg:px-6">
      <span>
        Vizualizare admin
        {supplierLabel ? ` · ${supplierLabel}` : " · toți furnizorii"}
      </span>
      {adminEmail ? <span className="truncate text-amber-400/80">{adminEmail}</span> : null}
      <Link href="/fleet/dashboard" className="shrink-0 text-amber-300 hover:underline">
        ← Flotă
      </Link>
    </div>
  );
}
