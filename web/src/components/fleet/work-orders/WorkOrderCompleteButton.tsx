"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  fleetJsonHeaders,
  workOrdersBrowserBase,
  type WorkOrderTicketSettlement,
} from "@/lib/work-orders-api";

function settlementLabel(s: WorkOrderTicketSettlement | null): string {
  if (!s) return "";
  const map: Record<WorkOrderTicketSettlement["entityType"], string> = {
    maintenance: "Mentenanță",
    cost: "Cost",
    document: "Document",
  };
  const date = new Date(s.createdAt).toLocaleDateString("ro-RO");
  return `${map[s.entityType]} (${date})`;
}

type Props = {
  workOrderId: string;
  canWrite: boolean;
  status: string;
  serviceCaseStatus?: string;
  outServiceDone: boolean;
  hasInvoicedQuote: boolean;
  hasCostFromQuote: boolean;
  ticketSettlement?: WorkOrderTicketSettlement | null;
  isPartner?: boolean;
};

export function WorkOrderCompleteButton({
  workOrderId,
  canWrite,
  status,
  serviceCaseStatus,
  outServiceDone,
  hasInvoicedQuote,
  hasCostFromQuote,
  ticketSettlement = null,
  isPartner = false,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!canWrite || status === "cancelled") return null;

  const caseClosed = serviceCaseStatus === "completed";
  const hasSettlement = hasCostFromQuote || !!ticketSettlement;

  if (isPartner) {
    if (status === "done") {
      return (
        <section className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <h2 className="text-sm font-medium text-emerald-200">Comandă finalizată</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Lucrarea e marcată gata. Flota închide dosarul după evidență (cost / mentenanță / document).
          </p>
        </section>
      );
    }
    if (!outServiceDone) return null;

    return (
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
        <h2 className="text-sm font-medium text-emerald-200">Gata lucrare</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Închide comanda din curtea service după Out. Nu e nevoie de cost flotă.
        </p>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => void complete()}
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Marchează gata / Închide WO
        </button>
      </section>
    );
  }

  if (status === "done" && caseClosed) return null;

  if (!hasSettlement && status === "done") {
    return (
      <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
        <h2 className="text-sm font-medium text-amber-100">WO închis de partener</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Lipsește evidența flotă (cost din deviz sau transformare mentenanță/cost/document) pentru a închide
          dosarul și tichetul.
        </p>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </section>
    );
  }

  if (!hasSettlement) {
    if (hasInvoicedQuote) {
      return (
        <section className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium text-zinc-200">Finalizare dosar</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Generați cost din deviz sau transformați din Acțiuni (mentenanță / cost / document), apoi închideți
            dosarul. Partenerul poate închide WO-ul după Out, independent.
          </p>
        </section>
      );
    }
    return null;
  }

  const title = status === "done" ? "Închide dosarul" : "Finalizează comandă & dosar";
  const hint = ticketSettlement
    ? `Evidență: ${settlementLabel(ticketSettlement)}${hasCostFromQuote ? " · + cost din deviz" : ""}.`
    : hasCostFromQuote
      ? "Evidență: cost generat din deviz."
      : "";

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
      <h2 className="text-sm font-medium text-emerald-200">Finalizare</h2>
      <p className="mt-1 text-xs text-zinc-400">
        {status === "done"
          ? "Comanda e deja gata — închideți dosarul și tichetul pe baza evidenței."
          : "Închide comanda și dosarul când există cost din deviz sau transformare din Acțiuni."}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-emerald-300/80">{hint}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void complete()}
        className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {title}
      </button>
    </section>
  );
}
