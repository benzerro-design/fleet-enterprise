"use client";

import { useCallback, useEffect, useState } from "react";
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
  /** L* poate invita R* (manager). R* doar R1/R0. */
  allowManagerRole?: boolean;
};

function roleLabel(role: string): string {
  if (role === "supplier_manager") return "Manager (R*)";
  if (role === "supplier_accountant") return "Contabil (R0)";
  return "Operator (R1)";
}

export function SupplierInvitePanel({ supplierId, allowManagerRole = false }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("supplier_staff");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<Invite | null>(null);
  const [items, setItems] = useState<Invite[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/invites`, { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as Invite[]);
    } catch {
      /* ignore */
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvite() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/invites`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ email: email.trim(), role }),
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
      <h3 className="text-sm font-semibold text-zinc-200">Invită utilizator portal</h3>
      <p className="mt-1 text-xs text-zinc-500">Link unic valabil 7 zile. Destinatarul își setează parola.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@furnizor.ro"
          className="min-w-[14rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {allowManagerRole ? <option value="supplier_manager">Manager (R*)</option> : null}
          <option value="supplier_staff">Operator / recepție (R1)</option>
          <option value="supplier_accountant">Contabil / citire (R0)</option>
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
          <p className="mt-1 break-all font-mono text-emerald-100">{lastInvite.inviteUrl}</p>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          {items.map((i) => (
            <li key={i.id}>
              {i.email} · {roleLabel(i.role)} · expiră {new Date(i.expiresAt).toLocaleDateString("ro-RO")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
