"use client";

import { useMemo, useState } from "react";
import { ClientInvitePanel } from "@/components/fleet/ClientInvitePanel";
import { MemberAccountActions } from "@/components/fleet/MemberAccountActions";
import { tenantBrowserBase } from "@/lib/fleet-api";
import { useRouter } from "next/navigation";

export type ClientOption = {
  id: string;
  code: string;
  legalName: string;
};

export type ClientMembershipRow = {
  id: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  userId: string;
  email: string;
  displayName: string | null;
  disabledAt?: string | null;
  role: string;
  driverId: string | null;
  driverFullName: string | null;
  createdAt: string;
};

const CLIENT_ROLES = [
  { value: "client_admin", label: "Administrator client (L1)" },
  { value: "client_dispatcher", label: "Dispecer client (L1)" },
  { value: "client_viewer", label: "Doar citire client" },
  { value: "driver", label: "Șofer (L0)" },
] as const;

function roleLabel(role: string): string {
  return CLIENT_ROLES.find((r) => r.value === role)?.label ?? role;
}

type Props = {
  memberships: ClientMembershipRow[];
  clients: ClientOption[];
};

export function ClientMembershipsPanel({ memberships, clients }: Props) {
  const router = useRouter();
  const [filterClientId, setFilterClientId] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");
  const [query, setQuery] = useState("");
  const [inviteClientId, setInviteClientId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const inviteSelected = clients.find((c) => c.id === inviteClientId);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return memberships.filter((m) => {
      if (filterClientId && m.clientId !== filterClientId) return false;
      if (filterRole && m.role !== filterRole) return false;
      if (filterStatus === "active" && m.disabledAt) return false;
      if (filterStatus === "disabled" && !m.disabledAt) return false;
      if (!needle) return true;
      const hay = `${m.email} ${m.displayName ?? ""} ${m.clientCode} ${m.clientLegalName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [memberships, filterClientId, filterRole, filterStatus, query]);

  async function removeMembership(id: string, label: string) {
    const yes = window.confirm(`Elimini accesul client pentru ${label}?`);
    if (!yes) return;
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/client-memberships/${encodeURIComponent(id)}`, {
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

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-200">
          Useri client · {visible.length}
          {visible.length !== memberships.length ? ` din ${memberships.length}` : ""}
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-[10rem] flex-1 text-xs text-zinc-500">
            Căutare
            <input
              type="search"
              name="client-member-search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="min-w-[9rem] text-xs text-zinc-500">
            Client
            <select
              value={filterClientId}
              onChange={(e) => setFilterClientId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value="">Toți</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
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
              {CLIENT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
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
              setFilterClientId("");
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
                  {m.clientCode} — {m.clientLegalName} · {roleLabel(m.role)}
                  {m.driverFullName ? ` · șofer: ${m.driverFullName}` : ""}
                </p>
                <MemberAccountActions userId={m.userId} disabledAt={m.disabledAt} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void removeMembership(m.id, m.email)}
                  className="mt-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
                >
                  Elimină accesul la acest client
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {clients.length === 0 ? (
        <p className="text-sm text-zinc-500">Niciun client activ — creează un client înainte de invitații L1.</p>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Organizație pentru invitație</span>
            <select
              value={inviteClientId}
              onChange={(e) => setInviteClientId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="">Alege clientul</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.legalName}
                </option>
              ))}
            </select>
          </label>
          {inviteSelected ? (
            <ClientInvitePanel clientId={inviteSelected.id} clientCode={inviteSelected.code} />
          ) : (
            <p className="text-xs text-zinc-500">Alege un client ca să generezi o invitație.</p>
          )}
        </div>
      )}
    </div>
  );
}
