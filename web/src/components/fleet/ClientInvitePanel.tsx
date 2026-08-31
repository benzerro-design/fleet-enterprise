"use client";

import { useCallback, useEffect, useState } from "react";
import { clientsBrowserBase } from "@/lib/clients-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";

export type ClientInviteRecord = {
  id: string;
  email: string;
  clientRole: string | null;
  inviteUrl: string;
  expiresAt: string;
};

const CLIENT_ROLES = [
  { value: "client_admin", label: "Administrator client (L1)" },
  { value: "client_dispatcher", label: "Dispecer client (L1)" },
  { value: "client_viewer", label: "Doar citire client" },
  { value: "driver", label: "Șofer (L0)" },
] as const;

type DriverOption = { id: string; fullName: string };

type Props = {
  clientId: string;
  clientCode: string;
};

export function ClientInvitePanel({ clientId, clientCode }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client_admin");
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<ClientInviteRecord | null>(null);
  const [items, setItems] = useState<ClientInviteRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/invites`, { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as ClientInviteRecord[]);
    } catch {
      /* ignore */
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (role !== "driver") {
      setDrivers([]);
      setDriverId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const p = new URLSearchParams({ clientId: clientCode, pageSize: "200", status: "active" });
      const res = await fetch(`/api/drivers?${p.toString()}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: Array<{ id: string; fullName: string }> };
      if (!cancelled) setDrivers((data.items ?? []).map((d) => ({ id: d.id, fullName: d.fullName })));
    })();
    return () => {
      cancelled = true;
    };
  }, [role, clientCode]);

  async function createInvite() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/invites`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          email: email.trim(),
          role,
          driverId: role === "driver" ? driverId || null : null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const invite = (await res.json()) as ClientInviteRecord;
      setLastInvite(invite);
      setEmail("");
      setDriverId("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut crea invitația.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Invită în echipa clientului</h3>
        <p className="mt-1 text-xs text-zinc-500">Link 7 zile — utilizatorul își alege parola.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@client.ro"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {CLIENT_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {role === "driver" ? (
          <select
            required
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">— șofer —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          disabled={pending || !email.trim() || (role === "driver" && !driverId)}
          onClick={() => void createInvite()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Generează invitație
        </button>
      </div>
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
      {lastInvite ? (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3 text-xs text-emerald-200">
          <p>Link pentru {lastInvite.email}:</p>
          <p className="mt-1 break-all font-mono text-emerald-100">{lastInvite.inviteUrl}</p>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="space-y-1 text-xs text-zinc-500">
          {items.map((i) => (
            <li key={i.id}>
              {i.email} · expiră {new Date(i.expiresAt).toLocaleDateString("ro-RO")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
