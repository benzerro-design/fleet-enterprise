"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TenantOption = { slug: string; name: string; role: string };

type Props = {
  currentSlug: string;
};

/** PARTNER-018 — schimbă abonatul din portalul partener. */
export function PartnerTenantSwitcher({ currentSlug }: Props) {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/tenants", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { tenants?: TenantOption[] };
        if (!cancelled) setTenants(data.tenants ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (tenants.length <= 1) {
    return (
      <span className="hidden font-mono text-[10px] text-zinc-600 sm:inline" title="Abonat">
        {currentSlug}
      </span>
    );
  }

  async function onChange(slug: string) {
    if (!slug || slug === currentSlug) return;
    setPending(true);
    try {
      const res = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: slug }),
      });
      if (!res.ok) return;
      router.replace("/fleet/partner");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      value={currentSlug}
      disabled={pending}
      onChange={(e) => void onChange(e.target.value)}
      className="max-w-[9rem] truncate rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-violet-500"
      title="Schimbă abonatul"
      aria-label="Abonat / flotă"
    >
      {tenants.map((t) => (
        <option key={t.slug} value={t.slug}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
