"use client";

import { useState } from "react";
import { fleetJsonHeaders, tenantBrowserBase } from "@/lib/fleet-api";

type Props = {
  userId: string;
  disabledAt?: string | null;
  isSelf?: boolean;
};

export function MemberAccountActions({ userId, disabledAt = null, isSelf = false }: Props) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountOff, setAccountOff] = useState(Boolean(disabledAt));

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
      setMessage("Parolă înlocuită. Userul intră cu parola nouă.");
    } finally {
      setPending(false);
    }
  }

  async function setDisabled(disabled: boolean) {
    const yes = window.confirm(
      disabled
        ? "Dezactivezi contul? Nu mai poate intra, dar rămâne în listă și îl poți reactiva."
        : "Reactivezi contul? Poate intra din nou cu parola existentă.",
    );
    if (!yes) return;
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
      setAccountOff(disabled);
      setMessage(disabled ? "Cont dezactivat. Nu mai poate intra." : "Cont reactivat.");
    } finally {
      setPending(false);
    }
  }

  const passwordReady = password.trim().length >= 10;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-xs text-zinc-400">
        Cont:{" "}
        <span className={accountOff ? "font-medium text-rose-700" : "font-medium text-emerald-700"}>
          {accountOff ? "dezactivat — nu poate intra" : "activ"}
        </span>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1 text-xs text-zinc-500">
          Parolă nouă
          <input
            type="password"
            name={`new-password-${userId}`}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <button
          type="button"
          disabled={pending || !passwordReady}
          onClick={() => void setNewPassword()}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Înlocuiește parola
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        Butonul de parolă se activează după 10 caractere. Nu schimbă organizația userului.
      </p>
      {isSelf ? (
        <p className="text-xs text-zinc-500">Contul cu care ești logat nu se dezactivează de aici.</p>
      ) : accountOff ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void setDisabled(false)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Reactivează contul
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => void setDisabled(true)}
          className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-500 disabled:opacity-40"
        >
          Dezactivează contul
        </button>
      )}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
