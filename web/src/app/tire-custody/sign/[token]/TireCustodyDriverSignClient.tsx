"use client";

import { useEffect, useRef, useState } from "react";
import {
  RsaSignaturePad,
  type RsaSignaturePadHandle,
} from "@/components/fleet/rsa/RsaSignaturePad";

type Preview = {
  protocolId: string;
  kind: string;
  revision: number;
  plate: string | null;
  setName: string | null;
  season: string | null;
  supplierName: string;
  locationText: string | null;
  expiresAt: string;
  hasDriverSignature: boolean;
};

export function TireCustodyDriverSignClient({ token }: { token: string }) {
  const padRef = useRef<RsaSignaturePadHandle>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/public/tire-custody/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(j.message ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as Preview;
        if (!cancelled) setPreview(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Link invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit() {
    if (!otp.trim() || !displayName.trim()) {
      setError("OTP și numele sunt obligatorii");
      return;
    }
    const exported = await padRef.current?.exportPngAndStrokes();
    if (!exported) {
      setError("Desenează semnătura");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Nu am putut citi semnătura"));
        reader.readAsDataURL(exported.blob);
      });
      const res = await fetch(`/api/public/tire-custody/${encodeURIComponent(token)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: otp.trim(),
          displayName: displayName.trim(),
          signaturePngUrl: dataUrl,
          strokePathJson: exported.strokes,
          deviceMetaJson: {
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            at: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Semnare eșuată");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-6 text-center">
        <p className="text-lg font-medium text-emerald-100">Semnătură înregistrată</p>
        <p className="mt-2 text-sm text-zinc-400">Poți închide această pagină.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Semnare PV anvelope</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Introdu OTP-ul primit de la hotel / service, apoi semnează.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
          <p>
            {preview.plate ?? "—"} · {preview.setName ?? preview.season ?? "set"}
          </p>
          <p className="text-xs text-zinc-500">
            {preview.supplierName}
            {preview.locationText ? ` · ${preview.locationText}` : ""} · rev {preview.revision}
          </p>
          {preview.hasDriverSignature ? (
            <p className="mt-2 text-xs text-amber-200">Semnătura șofer există deja pe acest PV.</p>
          ) : null}
        </div>
      ) : !error ? (
        <p className="text-sm text-zinc-500">Se încarcă…</p>
      ) : null}

      {preview && !preview.hasDriverSignature ? (
        <>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">OTP (6 cifre)</span>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 font-mono text-lg tracking-[0.3em] text-zinc-100"
              placeholder="••••••"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">Numele tău</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100"
            />
          </label>
          <RsaSignaturePad ref={padRef} disabled={pending} />
          <button
            type="button"
            disabled={pending}
            onClick={() => void submit()}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Semnează ca șofer
          </button>
        </>
      ) : null}
    </div>
  );
}
