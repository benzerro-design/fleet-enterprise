"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fleetJsonHeaders, tenantBrowserBase } from "@/lib/fleet-api";

type SupplierOption = { id: string; code: string; legalName: string };

type Props = {
  suppliers: SupplierOption[];
};

export function SupplierCreateMemberForm({ suppliers }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("supplier_staff");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/supplier-memberships`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || null,
          password,
          supplierId,
          role,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setOk("User creat pe furnizor. Poate intra imediat.");
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

  if (suppliers.length === 0) {
    return <p className="text-sm text-zinc-500">Niciun furnizor activ.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">Cont activ imediat. Minim 10 caractere la parolă.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">Alege furnizorul</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.legalName}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="email"
          name="supplier-create-email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@atelier.ro"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="supplier-create-name"
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
          <option value="supplier_manager">Manager (R*)</option>
          <option value="supplier_staff">Operator (R1)</option>
          <option value="supplier_accountant">Contabil (R0)</option>
        </select>
        <input
          type="password"
          name="supplier-create-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parolă (min. 10)"
          className="min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || !supplierId || !email.trim() || password.length < 10}
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
