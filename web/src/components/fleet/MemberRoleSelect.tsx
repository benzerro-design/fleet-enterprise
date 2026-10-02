"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tenantBrowserBase } from "@/lib/fleet-api";

const PROFILE_OPTIONS = [
  { value: "", label: "Fără F/T/G (legacy)" },
  { value: "F", label: "F — financiar" },
  { value: "T", label: "T — tehnic" },
  { value: "G", label: "G — gestiune" },
  { value: "full", label: "Full" },
] as const;

type Props = {
  userId: string;
  email: string;
  displayName?: string | null;
  joinedAt?: string;
  currentRole: string;
  currentProfile?: string | null;
  isCurrentUser?: boolean;
};

export function MemberRoleSelect({
  userId,
  email,
  displayName,
  joinedAt,
  currentRole,
  currentProfile = null,
  isCurrentUser = false,
}: Props) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [profile, setProfile] = useState(currentProfile ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const roleDirty = role !== currentRole;
  const profileDirty = profile !== (currentProfile ?? "");
  const dirty = roleDirty || profileDirty;

  async function save() {
    if (isCurrentUser || !dirty) return;
    const yes = window.confirm(`Confirmi actualizarea pentru ${email}?`);
    if (!yes) return;
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const body: { role?: string; functionalProfile?: string | null } = {};
      if (roleDirty) body.role = role;
      if (profileDirty) body.functionalProfile = profile === "" ? null : profile;
      const res = await fetch(`${tenantBrowserBase}/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setError(j.message ?? `HTTP ${res.status}`);
        return;
      }
      setOk("Actualizat.");
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
          <option value="tenant_admin">Administrator abonat (L*)</option>
          <option value="tenant_viewer">Cititor abonat</option>
        </select>
        <select
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          disabled={pending || isCurrentUser}
          title="Profil F/T/G (IAM-003)"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          {PROFILE_OPTIONS.map((o) => (
            <option key={o.value || "legacy"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || isCurrentUser || !dirty}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-500 disabled:opacity-40"
        >
          {pending ? "Salvez…" : "Salvează"}
        </button>
      </div>
      {error ? <p className="w-full text-sm text-amber-400">{error}</p> : null}
      {ok ? <p className="w-full text-sm text-emerald-400">{ok}</p> : null}
    </div>
  );
}
