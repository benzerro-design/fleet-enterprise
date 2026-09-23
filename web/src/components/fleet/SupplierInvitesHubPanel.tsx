"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SupplierInvitePanel } from "@/components/fleet/suppliers/SupplierInvitePanel";
import { MemberAccountActions } from "@/components/fleet/MemberAccountActions";
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
  disabledAt?: string | null;
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
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");
  const [query, setQuery] = useState("");
  const [inviteSupplierId, setInviteSupplierId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const inviteSelected = suppliers.find((s) => s.id === inviteSupplierId);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return memberships.filter((m) => {
      if (filterSupplierId && m.supplierId !== filterSupplierId) return false;
      if (filterRole && m.role !== filterRole) return false;
      if (filterStatus === "active" && m.disabledAt) return false;
      if (filterStatus === "disabled" && !m.disabledAt) return false;
      if (!needle) return true;
      const hay = `${m.email} ${m.displayName ?? ""} ${m.supplierCode} ${m.supplierLegalName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [memberships, filterSupplierId, filterRole, filterStatus, query]);

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
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-200">
          Useri furnizor · {visible.length}
          {visible.length !== memberships.length ? ` din ${memberships.length}` : ""}
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-[10rem] flex-1 text-xs text-zinc-500">
            Căutare
            <input
              type="search"
              name="supplier-member-search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="min-w-[9rem] text-xs text-zinc-500">
            Furnizor
            <select
              value={filterSupplierId}
              onChange={(e) => setFilterSupplierId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value="">Toți</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[9rem] text-xs text-zinc-500">
            Rol
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value="">Toți</option>
              <option value="supplier_manager">Manager (R*)</option>
              <option value="supplier_staff">Operator (R1)</option>
              <option value="supplier_accountant">Contabil (R0)</option>
            </select>
          </label>
          <label className="min-w-[8rem] text-xs text-zinc-500">
            Stare
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value="all">Toți</option>
              <option value="active">Activi</option>
              <option value="disabled">Dezactivați</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setFilterSupplierId("");
              setFilterRole("");
              setFilterStatus("all");
              setQuery("");
            }}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
          >
            Reset
          </button>
        </div>

        {visible.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun user pentru filtrele curente.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {visible.map((m) => (
              <li key={m.id} className="border-b border-zinc-800 pb-4 last:border-0">
                <p className="font-medium text-zinc-200">{m.email}</p>
                {m.displayName ? <p className="text-xs text-zinc-500">{m.displayName}</p> : null}
                <p className="mt-1 text-xs text-zinc-400">
                  {m.supplierCode} — {m.supplierLegalName} · {roleLabel(m.role)}
                </p>
                <MemberAccountActions userId={m.userId} disabledAt={m.disabledAt} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void removeMembership(m.id, m.email)}
                  className="mt-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
                >
                  Elimină accesul la acest furnizor
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Furnizor pentru invitație</span>
          <select
            value={inviteSupplierId}
            onChange={(e) => setInviteSupplierId(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">Alege furnizorul</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.legalName}
              </option>
            ))}
          </select>
        </label>
        {inviteSelected ? (
          <SupplierInvitePanel supplierId={inviteSelected.id} allowManagerRole />
        ) : (
          <p className="text-xs text-zinc-500">Alege un furnizor ca să generezi o invitație.</p>
        )}
      </div>
    </div>
  );
}
