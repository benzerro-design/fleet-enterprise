"use client";

import { useState } from "react";
import { fleetJsonHeaders, suppliersBrowserBase } from "@/lib/suppliers-api";

type Invite = {
  id: string;
  email: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
};

type Props = {
  supplierId: string;
};

export function SupplierInvitePanel({ supplierId }: Props) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<Invite | null>(null);

  async function createInvite() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/invites`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ email: email.trim(), role: "supplier_staff" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const invite = (await res.json()) as Invite;
      setLastInvite(invite);
      setEmail("");
    } catch {
      setError("Nu am putut crea invitația.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-sm font-semibold text-zinc-200">Invită utilizator portal</h3>
      <p className="mt-1 text-xs text-zinc-500">Generează link unic valabil 7 zile (PARTNER-001).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@furnizor.ro"
          className="min-w-[14rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
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
          <p className="mt-1 break-all font-mono text-emerald-100">{lastInvite.inviteUrl}</p>
        </div>
      ) : null}
    </div>
  );
}
