"use client";

import { useEffect, useState } from "react";
import { InviteCopyLink } from "@/components/fleet/InviteCopyLink";
import { fleetJsonHeaders, tenantBrowserBase } from "@/lib/fleet-api";

type Invite = {
  id: string;
  email: string;
  targetRole: string;
  inviteUrl: string;
  expiresAt: string;
};

export function TenantInvitePanel() {
  const [email, setEmail] = useState("");
  const [targetRole, setTargetRole] = useState("tenant_admin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<Invite | null>(null);
  const [items, setItems] = useState<Invite[]>([]);

  async function load() {
    try {
      const res = await fetch(`${tenantBrowserBase}/invites`, { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as Invite[]);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createInvite() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/invites`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ email: email.trim(), targetRole }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const invite = (await res.json()) as Invite;
      setLastInvite(invite);
      setEmail("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut crea invitația.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-sm font-semibold text-zinc-200">Invită în echipa abonatului (L*)</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Link unic 7 zile. Destinatarul își setează parola. Nu se trimite email — copiază linkul și trimite-l tu.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@abonat.ro"
          className="min-w-[14rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <select
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="tenant_admin">Administrator (L*)</option>
          <option value="tenant_viewer">Cititor</option>
        </select>
        <button
          type="button"
          disabled={pending || !email.trim()}
          onClick={() => void createInvite()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Generează invitație
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-amber-300">{error}</p> : null}
      {lastInvite ? (
        <div className="mt-3 rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3 text-xs text-emerald-200">
          <p>Link pentru {lastInvite.email}:</p>
          <InviteCopyLink url={lastInvite.inviteUrl} />
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-xs text-zinc-400">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {i.email} · {i.targetRole === "tenant_admin" ? "L*" : "cititor"} · expiră{" "}
                {new Date(i.expiresAt).toLocaleDateString("ro-RO")}
              </span>
              {i.inviteUrl ? <InviteCopyLink url={i.inviteUrl} compact /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
