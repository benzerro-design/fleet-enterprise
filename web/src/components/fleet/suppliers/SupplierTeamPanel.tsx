"use client";

import { useCallback, useEffect, useState } from "react";
import { SupplierInvitePanel } from "@/components/fleet/suppliers/SupplierInvitePanel";
import { fleetJsonHeaders, suppliersBrowserBase } from "@/lib/suppliers-api";

type Member = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  disabledAt: string | null;
  createdAt: string;
};

type Props = {
  supplierId: string;
  canInvite: boolean;
  allowManagerRole?: boolean;
};

function roleLabel(role: string): string {
  if (role === "supplier_manager") return "Manager (R*)";
  if (role === "supplier_accountant") return "Contabil (R0)";
  return "Operator (R1)";
}

export function SupplierTeamPanel({ supplierId, canInvite, allowManagerRole = false }: Props) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/memberships`, {
        cache: "no-store",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setMembers([]);
        return;
      }
      setMembers((await res.json()) as Member[]);
      setError(null);
    } catch {
      setError("Nu am putut încărca echipa.");
      setMembers([]);
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-zinc-500">Membri activi pe portalul partener.</p>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        {members === null && !error ? (
          <p className="mt-2 text-sm text-zinc-600">Se încarcă…</p>
        ) : null}
        {members && members.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Niciun membru încă — inviți din panoul de mai jos.</p>
        ) : null}
        {members && members.length > 0 ? (
          <ul className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-zinc-200">{m.displayName || m.email}</div>
                  <div className="text-xs text-zinc-500">{m.email}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300">
                    {roleLabel(m.role)}
                  </span>
                  {m.disabledAt ? (
                    <span className="text-amber-400">dezactivat</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {canInvite ? (
        <div className="border-t border-zinc-800 pt-4">
          <h3 className="text-sm font-medium text-zinc-200">Invită în echipă</h3>
          <div className="mt-2">
            <SupplierInvitePanel supplierId={supplierId} allowManagerRole={allowManagerRole} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Doar managerul (R*) poate invita membri noi.</p>
      )}
    </div>
  );
}
