"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clientsBrowserBase, type ClientRecord } from "@/lib/clients-api";

type BriefSectionProps = {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function BriefSection({ title, count, children, defaultOpen = false }: BriefSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-900/50"
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-zinc-500">
          {count != null ? <span className="font-mono text-[10px]">{count}</span> : null}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>
      {open ? <div className="border-t border-zinc-800 px-3 py-2">{children}</div> : null}
    </div>
  );
}

function statusPill(status: ClientRecord["status"]): string {
  return status === "active"
    ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-300/90"
    : "border-zinc-700 bg-zinc-900/60 text-zinc-500";
}

function normalizeTaxId(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

type Props = {
  mode: "create" | "edit";
  client?: ClientRecord | null;
  draftCode: string;
  draftTaxId: string;
  draftLegalName: string;
  codeBlurred: boolean;
  taxIdBlurred: boolean;
};

export function ClientFormBrief({
  mode,
  client,
  draftCode,
  draftTaxId,
  draftLegalName,
  codeBlurred,
  taxIdBlurred,
}: Props) {
  const [tenantClients, setTenantClients] = useState<ClientRecord[]>([]);
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "available" | "taken" | "similar">("idle");
  const [cuiMatches, setCuiMatches] = useState<ClientRecord[]>([]);
  const [billingPreview, setBillingPreview] = useState<ClientRecord[]>([]);

  const excludeId = client?.id;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${clientsBrowserBase}?pageSize=50`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: ClientRecord[] };
        if (!cancelled) setTenantClients(data.items);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "create" || !codeBlurred) {
      setCodeStatus("idle");
      return;
    }
    const code = draftCode.trim();
    if (!code) {
      setCodeStatus("idle");
      return;
    }

    let cancelled = false;
    setCodeStatus("checking");
    void (async () => {
      try {
        const res = await fetch(`${clientsBrowserBase}?q=${encodeURIComponent(code)}&pageSize=30`);
        if (!res.ok) {
          if (!cancelled) setCodeStatus("idle");
          return;
        }
        const data = (await res.json()) as { items: ClientRecord[] };
        if (cancelled) return;
        const exact = data.items.find((c) => c.code.toLowerCase() === code.toLowerCase());
        if (exact) {
          setCodeStatus("taken");
          return;
        }
        const prefix = code.slice(0, 3).toLowerCase();
        const similar = data.items.filter(
          (c) => prefix.length >= 2 && c.code.toLowerCase().startsWith(prefix),
        );
        setCodeStatus(similar.length > 0 ? "similar" : "available");
      } catch {
        if (!cancelled) setCodeStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, draftCode, codeBlurred]);

  useEffect(() => {
    if (!taxIdBlurred) {
      setCuiMatches([]);
      return;
    }
    const taxId = normalizeTaxId(draftTaxId);
    if (!taxId) {
      setCuiMatches([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${clientsBrowserBase}?q=${encodeURIComponent(taxId)}&pageSize=20`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: ClientRecord[] };
        if (cancelled) return;
        const matches = data.items.filter(
          (c) => c.taxId && normalizeTaxId(c.taxId) === taxId && c.id !== excludeId,
        );
        setCuiMatches(matches);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftTaxId, taxIdBlurred, excludeId]);

  useEffect(() => {
    const code = draftCode.trim();
    if (code.length < 2) {
      setBillingPreview([]);
      return;
    }
    const prefix = code.slice(0, 3).toLowerCase();
    const similar = tenantClients.filter(
      (c) =>
        c.id !== excludeId &&
        c.code.toLowerCase().startsWith(prefix) &&
        Boolean(c.billingNotes?.trim()),
    );
    setBillingPreview(similar.slice(0, 3));
  }, [draftCode, tenantClients, excludeId]);

  const displayName = draftLegalName.trim() || client?.legalName;
  const displayCode = draftCode.trim() || client?.code;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Context client</p>
        <p className="mt-1 text-sm text-zinc-400">Verificări și clienți existenți</p>
      </div>

      {displayName || displayCode ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          {displayCode ? (
            <p className="font-mono text-xs text-zinc-500">{displayCode}</p>
          ) : null}
          {displayName ? <p className="mt-0.5 font-medium text-zinc-100">{displayName}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Completează identificarea în formular.</p>
      )}

      {mode === "create" && codeBlurred && draftCode.trim() ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            codeStatus === "taken"
              ? "border-rose-800/60 bg-rose-950/30 text-rose-300"
              : codeStatus === "similar"
                ? "border-amber-800/60 bg-amber-950/30 text-amber-300"
                : codeStatus === "available"
                  ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-500"
          }`}
        >
          {codeStatus === "checking" ? "Verific cod…" : null}
          {codeStatus === "taken" ? `Codul „${draftCode.trim()}” este deja folosit.` : null}
          {codeStatus === "similar" ? "Cod similar existent — verifică lista de mai jos." : null}
          {codeStatus === "available" ? "Cod disponibil." : null}
        </div>
      ) : null}

      {taxIdBlurred && normalizeTaxId(draftTaxId) ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            cuiMatches.length > 0
              ? "border-rose-800/60 bg-rose-950/30 text-rose-300"
              : "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
          }`}
        >
          {cuiMatches.length > 0 ? (
            <>
              CUI deja înregistrat:{" "}
              {cuiMatches.map((c) => (
                <Link key={c.id} href={`/fleet/clients/${c.id}`} className="underline hover:text-white">
                  {c.code}
                </Link>
              ))}
            </>
          ) : (
            "CUI nefolosit în tenant."
          )}
        </div>
      ) : null}

      <BriefSection title="Clienți tenant" count={tenantClients.length} defaultOpen>
        {tenantClients.length === 0 ? (
          <p className="text-xs text-zinc-500">Niciun client încă.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {tenantClients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/fleet/clients/${c.id}`}
                  className="flex items-center justify-between gap-2 text-xs hover:text-white"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-zinc-400">{c.code}</span>
                    <span className="mx-1.5 text-zinc-600">·</span>
                    <span className="text-zinc-300">{c.legalName}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="font-mono text-[10px] text-zinc-500">{c.vehicleCount}v</span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase ${statusPill(c.status)}`}
                    >
                      {c.status === "active" ? "activ" : "inactiv"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </BriefSection>

      {billingPreview.length > 0 ? (
        <BriefSection title="Preview note facturare (similari)" count={billingPreview.length}>
          <ul className="space-y-2">
            {billingPreview.map((c) => (
              <li key={c.id} className="rounded border border-zinc-800/80 bg-zinc-950/30 p-2">
                <p className="font-mono text-[10px] text-zinc-500">{c.code}</p>
                <p className="mt-1 text-xs text-zinc-400">{c.billingNotes}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-zinc-600">Doar referință — nu se copiază automat.</p>
        </BriefSection>
      ) : null}

      {client && mode === "edit" ? (
        <BriefSection title="Rezumat">
          <dl className="space-y-1 text-xs text-zinc-400">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Vehicule</dt>
              <dd className="font-mono text-zinc-300">{client.vehicleCount}</dd>
            </div>
            {client.healthLabel ? (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Sănătate flotă</dt>
                <dd className="text-zinc-300">{client.healthLabel}</dd>
              </div>
            ) : null}
          </dl>
        </BriefSection>
      ) : null}
    </div>
  );
}
