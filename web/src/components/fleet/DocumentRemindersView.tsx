"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ReminderStatusBadge } from "@/components/fleet/ReminderStatusBadge";
import type { DocumentReminderSummary } from "@/lib/document-reminders";
import { formatOffsetDaysLabel } from "@/lib/document-reminders";
import { documentTypeLabel } from "@/lib/document-types";

type ReminderRow = {
  id: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  documentTypeCode: string;
  title: string;
  expiresOn: string | null;
  reminderOffsetsDays: number[] | null;
  reminder: DocumentReminderSummary;
};

type Payload = { items: ReminderRow[]; total: number; page: number; pageSize: number };

type Props = {
  vehicleId?: string;
  registrationNumber?: string;
  vehicleLabel?: string;
  backHref: string;
};

const STATUS_TABS = [
  { value: "action", label: "Necesită atenție" },
  { value: "upcoming", label: "Viitoare" },
  { value: "expired", label: "Expirate" },
  { value: "all", label: "Toate" },
] as const;

export function DocumentRemindersView({ vehicleId, registrationNumber, vehicleLabel, backHref }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") ?? "action") as (typeof STATUS_TABS)[number]["value"];

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    q.set("page", "1");
    q.set("pageSize", "100");
    q.set("status", status);
    if (vehicleId) q.set("vehicleId", vehicleId);
    if (registrationNumber) q.set("registrationNumber", registrationNumber);
    try {
      const res = await fetch(`/api/documents/reminders?${q.toString()}`);
      if (!res.ok) {
        setError((await res.text()) || `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData((await res.json()) as Payload);
    } catch {
      setError("Nu am putut încărca reminderele.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, vehicleId, registrationNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(next: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("status", next);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              status === tab.value
                ? "border-violet-500/60 bg-violet-950/50 text-violet-100"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {vehicleLabel ? (
        <p className="mb-4 text-sm text-zinc-400">
          Vehicul: <span className="font-mono text-zinc-200">{vehicleLabel}</span>
        </p>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      {!loading && !error && data?.items.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-10 text-center">
          <p className="text-zinc-300">Niciun reminder pentru filtrul selectat.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Adaugă documente cu dată de expirare și remindere activate.
          </p>
          <Link href={backHref} className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
            Înapoi
          </Link>
        </div>
      ) : null}

      {!loading && !error && data && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 transition-colors hover:border-zinc-700"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/fleet/documents/${row.id}`} className="font-medium text-zinc-100 hover:text-white">
                      {row.title}
                    </Link>
                    <ReminderStatusBadge reminder={row.reminder} compact />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {documentTypeLabel(row.documentTypeCode)} ·{" "}
                    <Link href={`/fleet/vehicles/${row.vehicleId}`} className="font-mono text-zinc-400 hover:text-zinc-200">
                      {row.registrationNumber}
                    </Link>
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <p>
                    Expiră:{" "}
                    <span className="font-mono text-zinc-300">
                      {row.expiresOn ? new Date(row.expiresOn).toLocaleDateString("ro-RO") : "—"}
                    </span>
                  </p>
                  {row.reminder.nextRemindOn ? (
                    <p className="mt-1">
                      Următorul reminder:{" "}
                      <span className="font-mono text-violet-300">
                        {new Date(row.reminder.nextRemindOn).toLocaleDateString("ro-RO")}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              {row.reminderOffsetsDays?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {row.reminderOffsetsDays.map((d) => (
                    <span
                      key={d}
                      className="rounded border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[10px] text-zinc-500"
                    >
                      {formatOffsetDaysLabel(d)}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          <p className="text-xs text-zinc-600">{data.total} reminder(e) · afișare in-app (fără email încă)</p>
        </div>
      ) : null}
    </>
  );
}
