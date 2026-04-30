"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tenantBrowserBase } from "@/lib/fleet-api";

type Props = {
  userId: string;
  email: string;
  displayName?: string | null;
  joinedAt?: string;
  currentRole: string;
  isCurrentUser?: boolean;
};

export function MemberRoleSelect({
  userId,
  email,
  displayName,
  joinedAt,
  currentRole,
  isCurrentUser = false,
}: Props) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save() {
    if (isCurrentUser || role === currentRole) return;
    const label = role === "tenant_admin" ? "Administrator tenant" : "Doar citire";
    const yes = window.confirm(`Confirmi schimbarea rolului pentru ${email} la „${label}”?`);
    if (!yes) return;
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      setOk("Rol actualizat.");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-zinc-200">
          {email}{" "}
          {isCurrentUser ? (
            <span className="rounded border border-emerald-900/70 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
              tu
            </span>
          ) : null}
        </p>
        {displayName ? <p className="text-xs text-zinc-500">{displayName}</p> : null}
        {joinedAt ? (
          <p className="text-xs text-zinc-600">membru din {new Date(joinedAt).toLocaleDateString("ro-RO")}</p>
        ) : null}
        <p className="font-mono text-xs text-zinc-500">{userId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={pending || isCurrentUser}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="tenant_admin">Administrator tenant</option>
          <option value="tenant_viewer">Doar citire</option>
        </select>
        <button
          type="button"
          disabled={pending || isCurrentUser || role === currentRole}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-500 disabled:opacity-40"
        >
          {pending ? "Salvez…" : "Salvează rol"}
        </button>
      </div>
      {error ? <p className="w-full text-sm text-amber-400">{error}</p> : null}
      {ok ? <p className="w-full text-sm text-emerald-400">{ok}</p> : null}
    </div>
  );
}
