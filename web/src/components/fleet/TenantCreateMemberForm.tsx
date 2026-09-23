"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fleetJsonHeaders, tenantBrowserBase } from "@/lib/fleet-api";

export function TenantCreateMemberForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tenant_viewer");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/members`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || null,
          password,
          role,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setOk("User creat. Poate intra imediat cu emailul și parola setate.");
      setEmail("");
      setDisplayName("");
      setPassword("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Cont activ imediat. Minim 10 caractere la parolă. Trimite parola pe canal securizat.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          inputMode="email"
          name="tenant-create-email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@abonat.ro"
          className="min-w-[14rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="tenant-create-name"
          autoComplete="off"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Nume afișat (opțional)"
          className="min-w-[10rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="tenant_admin">Administrator abonat (L*)</option>
          <option value="tenant_viewer">Cititor abonat</option>
        </select>
        <input
          type="password"
          name="tenant-create-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parolă (min. 10)"
          className="min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || !email.trim() || password.length < 10}
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
