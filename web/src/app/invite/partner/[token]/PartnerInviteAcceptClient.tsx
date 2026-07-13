"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fleetJsonHeaders } from "@/lib/fleet-api";

type Preview = {
  email: string;
  supplierLegalName: string;
  supplierCode: string;
  expiresAt: string;
};

export function PartnerInviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/partner-invites/${token}`);
        if (!res.ok) throw new Error("Invitație invalidă");
        setPreview((await res.json()) as Preview);
      } catch {
        setError("Invitația nu este validă sau a expirat.");
      }
    })();
  }, [token]);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner-invites/${token}`, {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (res.status === 401) {
        router.push(`/login?next=/invite/partner/${token}`);
        return;
      }
      if (!res.ok) throw new Error("Accept eșuat");
      router.push("/fleet/partner");
    } catch {
      setError("Nu am putut accepta invitația.");
    } finally {
      setPending(false);
    }
  }

  if (error && !preview) {
    return <p className="text-amber-300">{error}</p>;
  }

  if (!preview) return <p className="text-zinc-500">Se încarcă invitația…</p>;

  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h1 className="text-xl font-semibold text-zinc-100">Invitație portal partener</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {preview.supplierLegalName} ({preview.supplierCode})
      </p>
      <p className="mt-4 text-sm text-zinc-300">
        Cont: <span className="font-mono">{preview.email}</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Expiră: {new Date(preview.expiresAt).toLocaleString("ro-RO")}
      </p>
      {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void accept()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Acceptă invitația
        </button>
        <Link href="/login" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
          Login
        </Link>
      </div>
    </div>
  );
}
