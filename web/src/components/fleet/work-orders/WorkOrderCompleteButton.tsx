"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fleetJsonHeaders, workOrdersBrowserBase } from "@/lib/work-orders-api";

type Props = {
  workOrderId: string;
  canWrite: boolean;
  status: string;
  hasInvoicedQuote: boolean;
  hasCostFromQuote: boolean;
};

export function WorkOrderCompleteButton({
  workOrderId,
  canWrite,
  status,
  hasInvoicedQuote,
  hasCostFromQuote,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite || status === "done" || status === "cancelled" || !hasInvoicedQuote || !hasCostFromQuote) {
    return null;
  }

  async function complete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/complete`, {
        method: "POST",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
      <h2 className="text-sm font-medium text-emerald-200">Finalizare</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Închide comanda service și dosarul lucrare după facturare.
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void complete()}
        className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Finalizează comandă
      </button>
    </section>
  );
}
