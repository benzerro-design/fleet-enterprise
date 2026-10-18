"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n/useT";

type TenantOption = { slug: string; name: string; role: string };

type Props = { nextPath: string };

export function LoginForm({ nextPath }: Props) {
  const tx = useT();
  const router = useRouter();
  const [email, setEmail] = useState("admin@demo.local");
  const [tenantSlug, setTenantSlug] = useState("demo");
  const [password, setPassword] = useState("");
  const [tenants, setTenants] = useState<TenantOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function completeLogin(destinationHint?: string) {
    let destination = destinationHint ?? nextPath;
    try {
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          role?: string;
          clientPortal?: "fleet" | "driver" | "tickets";
          partnerPortal?: boolean;
        };
        if (me.role === "supplier_user" || me.partnerPortal) {
          destination = "/fleet/partner";
        } else if (me.role === "client_user") {
          if (me.clientPortal === "fleet") destination = "/fleet/dashboard";
          else if (me.clientPortal === "driver") destination = "/fleet/vehicles";
          else destination = "/fleet/tickets";
        }
      }
    } catch {
      /* fallback nextPath */
    }
    router.replace(destination);
    router.refresh();
  }

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

      const data = (await res.json()) as {
        ok?: boolean;
        requiresTenant?: boolean;
        tenants?: TenantOption[];
      };

      if (data.requiresTenant && data.tenants?.length) {
        setTenants(data.tenants);
        setTenantSlug(data.tenants[0]?.slug ?? "");
        setError(null);
        return;
      }

      await completeLogin();
    } catch {
      setError(tx("auth.login.serverError"));
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

      {tenants?.length ? (
        <p className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2 text-sm text-violet-200">
          Cont pe mai mulți abonați — alege flotă, apoi Continuă.
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{tx("auth.login.email")}</label>
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
        <label className="block text-sm font-medium text-zinc-300">{tx("auth.login.tenant")}</label>
        {tenants?.length ? (
          <select
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          >
            {tenants.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        ) : (
          <input
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            placeholder={tx("auth.login.tenantPlaceholder")}
            autoComplete="organization"
          />
        )}
        <p className="text-xs text-zinc-500">{tx("auth.login.tenantHint")}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">{tx("auth.login.password")}</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder={tx("auth.login.passwordPlaceholder")}
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending
          ? tx("auth.login.pending")
          : tenants?.length
            ? "Continuă"
            : tx("auth.login.submit")}
      </button>
    </form>
  );
}
