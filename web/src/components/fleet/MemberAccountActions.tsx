"use client";

import { useState } from "react";
import { fleetJsonHeaders, tenantBrowserBase } from "@/lib/fleet-api";

type Props = {
  userId: string;
  disabled?: boolean;
};

export function MemberAccountActions({ userId }: Props) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setNewPassword() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/members/${userId}/password`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setError(typeof j.message === "string" ? j.message : `HTTP ${res.status}`);
        return;
      }
      setPassword("");
      setMessage("Parolă înlocuită.");
    } finally {
      setPending(false);
    }
  }

  async function setDisabled(disabled: boolean) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${tenantBrowserBase}/members/${userId}/access`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ disabled }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        setError(typeof j.message === "string" ? j.message : `HTTP ${res.status}`);
        return;
      }
      setMessage(disabled ? "Cont dezactivat." : "Cont reactivat.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Cont</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1 text-xs text-zinc-400">
          Parolă nouă (min. 10)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <button
          type="button"
          disabled={pending || password.trim().length < 10}
          onClick={() => void setNewPassword()}
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Înlocuiește parola
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void setDisabled(true)}
          className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200"
        >
          Dezactivează
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void setDisabled(false)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          Reactivează
        </button>
      </div>
      {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
