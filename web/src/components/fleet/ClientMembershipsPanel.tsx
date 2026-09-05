"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientInvitePanel } from "@/components/fleet/ClientInvitePanel";
import { tenantBrowserBase } from "@/lib/fleet-api";

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
  const [clientId, setClientId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected = clients.find((c) => c.id === clientId);
  const visible = clientId ? memberships.filter((m) => m.clientId === clientId) : memberships;

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
      {clients.length === 0 ? (
        <p className="text-sm text-zinc-500">Niciun client activ — creează un client înainte de invitații L1.</p>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Client (organizație)</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="">Toți clienții</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.legalName}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <ClientInvitePanel clientId={selected.id} clientCode={selected.code} />
          ) : (
            <p className="text-xs text-zinc-500">
              Alege un client ca să generezi o invitație. Lista de mai jos arată toți userii L1/L0.
            </p>
          )}
        </div>
      )}

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-200">
          Useri client {clientId ? "pentru organizația aleasă" : "(toți)"} · {visible.length}
        </h2>
        {visible.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun user client încă.</p>
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
                    {m.clientCode} — {m.clientLegalName} · {roleLabel(m.role)}
                    {m.driverFullName ? ` · șofer: ${m.driverFullName}` : ""}
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
