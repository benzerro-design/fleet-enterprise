"use client";

import { useState } from "react";
import { SupplierInvitePanel } from "@/components/fleet/suppliers/SupplierInvitePanel";

export type SupplierInviteOption = {
  id: string;
  code: string;
  legalName: string;
};

type Props = {
  suppliers: SupplierInviteOption[];
};

export function SupplierInvitesHubPanel({ suppliers }: Props) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const selected = suppliers.find((s) => s.id === supplierId) ?? suppliers[0];

  if (suppliers.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Niciun furnizor activ — creează un furnizor înainte de invitații R*.</p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-zinc-500">Furnizor</span>
        <select
          value={selected?.id ?? ""}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.legalName}
            </option>
          ))}
        </select>
      </label>
      {selected ? <SupplierInvitePanel supplierId={selected.id} allowManagerRole /> : null}
    </div>
  );
}
