"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fleetJsonHeaders } from "@/lib/fleet-api";

type Preview = {
  email: string;
  tenantSlug: string;
  supplierLegalName: string;
  supplierCode: string;
  expiresAt: string;
};

type AuthMe = { email?: string; role?: string };

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") return j.message;
    if (Array.isArray(j.message)) return j.message.join(", ");
  } catch {
    /* ignore */
  }
  return fallback;
}

export function PartnerInviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [previewRes, meRes] = await Promise.all([
          fetch(`/api/partner-invites/${token}`),
          fetch("/api/auth/me"),
        ]);
        if (!previewRes.ok) throw new Error("Invitație invalidă");
        setPreview((await previewRes.json()) as Preview);
        if (meRes.ok) {
          const me = (await meRes.json()) as AuthMe;
          setAuthEmail(me.email?.trim().toLowerCase() ?? null);
        }
      } catch {
        setError("Invitația nu este validă sau a expirat.");
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [token]);

  const inviteEmail = preview?.email.trim().toLowerCase() ?? "";
  const loggedInMatch = Boolean(authEmail && inviteEmail && authEmail === inviteEmail);
  const loggedInMismatch = Boolean(authEmail && inviteEmail && authEmail !== inviteEmail);

  async function loginAfterAccept(email: string, tenantSlug: string, pass: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, tenantSlug }),
    });
    if (!res.ok) {
      router.push(`/login?next=/fleet/partner`);
      return;
    }
    router.push("/fleet/partner");
    router.refresh();
  }

  async function acceptLoggedIn() {
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
      if (!res.ok) throw new Error(await readApiError(res, "Accept eșuat"));
      router.push("/fleet/partner");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut accepta invitația.");
    } finally {
      setPending(false);
    }
  }

  async function acceptWithPassword() {
    if (!preview) return;
    setPending(true);
    setError(null);
    try {
      if (loggedInMismatch) {
        await fetch("/api/auth/logout", { method: "POST" });
      }
      const res = await fetch(`/api/partner-invites/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Accept eșuat"));
      await loginAfterAccept(preview.email, preview.tenantSlug, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut accepta invitația.");
    } finally {
      setPending(false);
    }
  }

  if (error && !preview) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-amber-300">{error}</p>
        <p className="text-sm text-zinc-500">
          Linkurile de pe staging nu funcționează pe localhost — baza de date e diferită. Generează o
          invitație nouă în același mediu în care o deschizi.
        </p>
      </div>
    );
  }

  if (!preview || !authChecked) return <p className="text-zinc-500">Se încarcă invitația…</p>;

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
        Tenant: <span className="font-mono">{preview.tenantSlug}</span> · Expiră:{" "}
        {new Date(preview.expiresAt).toLocaleString("ro-RO")}
      </p>

      {loggedInMismatch ? (
        <p className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
          Ești autentificat ca <span className="font-mono">{authEmail}</span>. Invitația e pentru{" "}
          <span className="font-mono">{preview.email}</span>. Poți folosi formularul de mai jos — sesiunea
          admin va fi înlocuită automat.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}

      {loggedInMatch ? (
        <div className="mt-6">
          <button
            type="button"
            disabled={pending}
            onClick={() => void acceptLoggedIn()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? "Accept…" : "Acceptă invitația"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-zinc-400">
            {authEmail
              ? "Creează sau confirmă contul partener cu parola de mai jos."
              : "Cont nou sau existent — setează parola (min. 10 caractere) pentru a accepta."}
          </p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nume afișat (opțional)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parolă (min. 10 caractere)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || password.length < 10}
            onClick={() => void acceptWithPassword()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? "Creez cont și accept…" : "Creează cont și acceptă"}
          </button>
          <p className="text-xs text-zinc-500">
            Ai deja cont?{" "}
            <Link
              href={`/login?next=/invite/partner/${token}`}
              className="text-violet-300 hover:underline"
            >
              Autentifică-te
            </Link>{" "}
            cu <span className="font-mono">{preview.email}</span> și tenant{" "}
            <span className="font-mono">{preview.tenantSlug}</span>.
          </p>
        </div>
      )}
    </div>
  );
}

