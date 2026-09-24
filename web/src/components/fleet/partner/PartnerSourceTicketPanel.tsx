"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeRo } from "@/lib/datetime-local";
import { fleetJsonHeaders, workOrdersBrowserBase } from "@/lib/work-orders-api";

export type PartnerSourceTicketStoryItem = {
  id: string;
  kind: "comment" | "status";
  text: string | null;
  actorLabel: string;
  createdAt: string;
};

export type PartnerSourceTicketPayload = {
  ticket: {
    id: string;
    displayId: string | null;
    subject: string;
    description: string | null;
    status: string;
    ticketType: string;
    createdAt: string;
    driverName: string | null;
    driverPhone: string | null;
    vehicle: {
      registrationNumber: string;
      brand: string | null;
      model: string | null;
      vin: string | null;
    };
  } | null;
  story: PartnerSourceTicketStoryItem[];
};

type Props = {
  workOrderId: string;
  /** Compact trigger in Tranzacție panel */
  compact?: boolean;
};

export function PartnerSourceTicketPanel({ workOrderId, compact = false }: Props) {
  const [open, setOpen] = useState(!compact);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PartnerSourceTicketPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/source-ticket`, {
        headers: fleetJsonHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as PartnerSourceTicketPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu s-a putut încărca tichetul");
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (open && !data && !loading) void load();
  }, [open, data, loading, load]);

  if (compact) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-left text-emerald-400 hover:underline"
        >
          {open ? "Ascunde tichetul sursă" : "Vezi tichetul sursă"}
        </button>
        {open ? <PanelBody loading={loading} error={error} data={data} /> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Tichet sursă (read-only)
      </div>
      <PanelBody loading={loading} error={error} data={data} />
    </div>
  );
}

function PanelBody({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data: PartnerSourceTicketPayload | null;
}) {
  if (loading && !data) {
    return <p className="text-xs text-zinc-500">Se încarcă…</p>;
  }
  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }
  if (!data?.ticket) {
    return <p className="text-xs text-zinc-500">Fără tichet sursă pe această comandă.</p>;
  }

  const t = data.ticket;
  const vehicleLabel =
    [t.vehicle.brand, t.vehicle.model].filter(Boolean).join(" ") || "—";

  return (
    <div className="space-y-2 text-xs text-zinc-300">
      <div>
        <span className="font-mono text-violet-300">#{t.displayId}</span>
        <span className="mx-1.5 text-zinc-600">·</span>
        <span className="font-medium text-zinc-100">{t.subject}</span>
      </div>
      {t.description ? (
        <p className="whitespace-pre-wrap text-zinc-400">{t.description}</p>
      ) : null}
      <dl className="grid gap-1 border-t border-zinc-800 pt-2">
        <div className="grid grid-cols-[72px_1fr] gap-1">
          <dt className="text-zinc-500">Vehicul</dt>
          <dd>
            {t.vehicle.registrationNumber}
            <span className="text-zinc-500"> · {vehicleLabel}</span>
          </dd>
        </div>
        {t.driverName ? (
          <div className="grid grid-cols-[72px_1fr] gap-1">
            <dt className="text-zinc-500">Șofer</dt>
            <dd>
              {t.driverName}
              {t.driverPhone ? ` · ${t.driverPhone}` : ""}
            </dd>
          </div>
        ) : null}
        <div className="grid grid-cols-[72px_1fr] gap-1">
          <dt className="text-zinc-500">Status</dt>
          <dd className="capitalize text-zinc-200">{t.status.replace(/_/g, " ")}</dd>
        </div>
      </dl>

      <div className="border-t border-zinc-800 pt-2">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Istoric (filtrat)
        </div>
        {data.story.length === 0 ? (
          <p className="text-zinc-500">Niciun mesaj vizibil pentru atelier.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {data.story.map((ev) => (
              <li key={ev.id} className="rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-1 text-[10px] text-zinc-500">
                  <span className="font-medium text-zinc-400">{ev.actorLabel}</span>
                  <span>{formatDateTimeRo(ev.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-zinc-200">
                  {ev.kind === "status" ? (
                    <span className="italic text-zinc-400">{ev.text}</span>
                  ) : (
                    ev.text
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-zinc-600">
          Fără acțiuni pe tichet — doar context pentru reparație.
        </p>
      </div>
    </div>
  );
}
