"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SupplierInvitePanel } from "@/components/fleet/suppliers/SupplierInvitePanel";
import { tenantBrowserBase } from "@/lib/fleet-api";

export type SupplierInviteOption = {
  id: string;
  code: string;
  legalName: string;
};

export type SupplierMembershipRow = {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierLegalName: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
};

type Props = {
  suppliers: SupplierInviteOption[];
  memberships: SupplierMembershipRow[];
};

function roleLabel(role: string): string {
  if (role === "supplier_manager") return "Manager (R*)";
  if (role === "supplier_accountant") return "Contabil (R0)";
  return "Operator (R1)";
}

export function SupplierInvitesHubPanel({ suppliers, memberships }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected = suppliers.find((s) => s.id === supplierId);
  const visible = supplierId ? memberships.filter((m) => m.supplierId === supplierId) : memberships;

  async function removeMembership(id: string, label: string) {
    const yes = window.confirm(`Elimini accesul furnizor pentru ${label}?`);
    if (!yes) return;
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/supplier-memberships/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setOk("Acces eliminat.");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  if (suppliers.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Niciun furnizor activ — creează un furnizor înainte de invitații R*.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Furnizor</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">Toți furnizorii</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.legalName}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <SupplierInvitePanel supplierId={selected.id} allowManagerRole />
        ) : (
          <p className="text-xs text-zinc-500">
            Alege un furnizor ca să generezi o invitație. Lista de mai jos arată toți userii R*/R1/R0.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-200">
          Useri furnizor {supplierId ? "pentru organizația aleasă" : "(toți)"} · {visible.length}
        </h2>
        {visible.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun user furnizor încă.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {visible.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 border-b border-zinc-800 pb-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-200">{m.email}</p>
                  {m.displayName ? <p className="text-xs text-zinc-500">{m.displayName}</p> : null}
                  <p className="mt-1 text-xs text-zinc-400">
                    {m.supplierCode} — {m.supplierLegalName} · {roleLabel(m.role)}
                  </p>
                  <p className="text-xs text-zinc-600">
                    din {new Date(m.createdAt).toLocaleDateString("ro-RO")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void removeMembership(m.id, m.email)}
                  className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                >
                  Elimină acces
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
