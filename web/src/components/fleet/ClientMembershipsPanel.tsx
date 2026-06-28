"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

type DriverOption = { id: string; fullName: string };

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
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.code ?? "");
  const [role, setRole] = useState<string>("client_admin");
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadDrivers = useCallback(async (clientCode: string) => {
    if (!clientCode.trim()) {
      setDrivers([]);
      return;
    }
    setDriversLoading(true);
    try {
      const p = new URLSearchParams({ clientId: clientCode, pageSize: "200", status: "active" });
      const res = await fetch(`/api/drivers?${p.toString()}`);
      if (!res.ok) {
        setDrivers([]);
        return;
      }
      const data = (await res.json()) as { items?: Array<{ id: string; fullName: string }> };
      setDrivers((data.items ?? []).map((d) => ({ id: d.id, fullName: d.fullName })));
    } catch {
      setDrivers([]);
    } finally {
      setDriversLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === "driver" && clientId) {
      void loadDrivers(clientId);
    } else {
      setDrivers([]);
      setDriverId("");
    }
  }, [role, clientId, loadDrivers]);

  async function createMembership(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/client-memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || null,
          password,
          clientId,
          role,
          driverId: role === "driver" ? driverId || null : null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        setError(msg ?? `HTTP ${res.status}`);
        return;
      }
      setOk("User client creat.");
      setEmail("");
      setDisplayName("");
      setPassword("");
      setDriverId("");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

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
      <form
        onSubmit={(e) => void createMembership(e)}
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
      >
        <h2 className="text-sm font-medium text-zinc-200">Invită user client</h2>
        <p className="text-xs text-zinc-500">
          Creează cont pentru angajatul clientului (manager, șofer, HR). Accesul este limitat la clientul
          selectat.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Nume afișat</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Parolă inițială (min. 10)</span>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Client (organizație)</span>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              {clients.length === 0 ? (
                <option value="">— fără clienți —</option>
              ) : (
                clients.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.legalName}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Rol în client</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              {CLIENT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {role === "driver" ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-zinc-500">Șofer (entitate)</span>
              <select
                required
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                disabled={driversLoading}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">{driversLoading ? "Se încarcă…" : "— selectează —"}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending || clients.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-500 disabled:opacity-40"
        >
          {pending ? "Creez…" : "Creează user client"}
        </button>
        {error ? <p className="text-sm text-amber-400">{error}</p> : null}
        {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}
      </form>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-200">Useri client existenți</h2>
        {memberships.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun user client încă.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {memberships.map((m) => (
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
