"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = { nextPath: string };

export function LoginForm({ nextPath }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@demo.local");
  const [tenantSlug, setTenantSlug] = useState("demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          tenantSlug: tenantSlug.trim() || undefined,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Nu m-am putut conecta la server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="admin@demo.local"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Tenant (slug)</label>
        <input
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="demo (opțional dacă ai un singur tenant)"
          autoComplete="organization"
        />
        <p className="text-xs text-zinc-500">
          Obligatoriu dacă utilizatorul are acces la mai mulți tenanți; după seed, demo are un singur tenant. Viewer:
          același tenant <span className="font-mono text-zinc-400">demo</span> și aceeași parolă demo ca admin (
          <span className="font-mono text-zinc-400">demo12345</span>); dacă primești „Invalid credentials”, rulează
          din nou <span className="font-mono text-zinc-400">npm run db:seed</span> în folderul API.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Parolă</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="parola din baza de date (vezi seed)"
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? "Conectare…" : "Intră"}
      </button>
    </form>
  );
}
