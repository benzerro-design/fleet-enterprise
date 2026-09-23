"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fleetJsonHeaders, tenantBrowserBase } from "@/lib/fleet-api";

const CLIENT_ROLES = [
  { value: "client_admin", label: "Administrator client (L1)" },
  { value: "client_dispatcher", label: "Dispecer client (L1)" },
  { value: "client_viewer", label: "Doar citire client" },
  { value: "driver", label: "Șofer (L0)" },
] as const;

type ClientOption = { id: string; code: string; legalName: string };

type Props = {
  clients: ClientOption[];
  /** Prefill client (ex. L1 pe un singur client). */
  lockedClientId?: string;
};

export function ClientCreateMemberForm({ clients, lockedClientId }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState(lockedClientId ?? "");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client_admin");
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (lockedClientId) setClientId(lockedClientId);
  }, [lockedClientId]);

  useEffect(() => {
    if (role !== "driver" || !selected) {
      setDrivers([]);
      setDriverId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const p = new URLSearchParams({
        clientId: selected.code,
        pageSize: "200",
        status: "active",
      });
      const res = await fetch(`/api/drivers?${p.toString()}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: Array<{ id: string; fullName: string }> };
      if (!cancelled) {
        setDrivers((data.items ?? []).map((d) => ({ id: d.id, fullName: d.fullName })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, selected]);

  async function submit() {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/client-memberships`, {
        method: "POST",
        headers: fleetJsonHeaders(),
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
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setOk("User creat pe client. Poate intra imediat.");
      setEmail("");
      setDisplayName("");
      setPassword("");
      setDriverId("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creare eșuată");
    } finally {
      setPending(false);
    }
  }

  if (clients.length === 0) {
    return <p className="text-sm text-zinc-500">Niciun client activ.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Cont activ imediat. Minim 10 caractere la parolă.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!lockedClientId ? (
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">Alege clientul</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.legalName}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="text"
          inputMode="email"
          name="client-create-email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@client.ro"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="client-create-name"
          autoComplete="off"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Nume (opțional)"
          className="min-w-[8rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">Alege șoferul</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="password"
          name="client-create-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parolă (min. 10)"
          className="min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={
            pending ||
            !clientId ||
            !email.trim() ||
            password.length < 10 ||
            (role === "driver" && !driverId)
          }
          onClick={() => void submit()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Creează user
        </button>
      </div>
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
      {ok ? <p className="text-xs text-emerald-300">{ok}</p> : null}
    </div>
  );
}
