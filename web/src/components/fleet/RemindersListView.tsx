"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DeleteReminderButton } from "@/components/fleet/DeleteReminderButton";
import { ReminderActionStatusBadge } from "@/components/fleet/ReminderActionStatusBadge";
import { formatOffsetDaysLabel } from "@/lib/document-reminders";
import { formatOffsetKmLabel, reminderSourceLabel, type ReminderActionRow } from "@/lib/reminder-actions";
import { documentTypeLabel } from "@/lib/document-types";

type Payload = { items: ReminderActionRow[]; total: number; page: number; pageSize: number };

type Props = {
  vehicleId?: string;
  registrationNumber?: string;
  vehicleLabel?: string;
  backHref: string;
  write?: boolean;
  compact?: boolean;
};

const STATUS_TABS = [
  { value: "action", label: "Necesită atenție" },
  { value: "upcoming", label: "Viitoare" },
  { value: "expired", label: "Depășite" },
  { value: "all", label: "Toate" },
] as const;

export function RemindersListView({
  vehicleId,
  registrationNumber,
  vehicleLabel,
  backHref,
  write = false,
  compact = false,
}: Props) {
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
    q.set("pageSize", compact ? "20" : "100");
    q.set("status", status);
    if (vehicleId) q.set("vehicleId", vehicleId);
    if (registrationNumber) q.set("registrationNumber", registrationNumber);
    try {
      const res = await fetch(`/api/reminders?${q.toString()}`);
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
  }, [status, vehicleId, registrationNumber, compact]);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(next: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("status", next);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  const newHref = vehicleId
    ? `/fleet/reminders/new?vehicleId=${encodeURIComponent(vehicleId)}`
    : "/fleet/reminders/new";

  return (
    <>
      {!compact ? (
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
      ) : null}

      {vehicleLabel ? (
        <p className="mb-4 text-sm text-zinc-400">
          Vehicul: <span className="font-mono text-zinc-200">{vehicleLabel}</span>
        </p>
      ) : null}

      {write && !compact ? (
        <div className="mb-4">
          <Link
            href={newHref}
            className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Acțiune reminder nouă
          </Link>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}
      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      {!loading && !error && data?.items.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-8 text-center">
          <p className="text-zinc-300">Niciun reminder pentru filtrul selectat.</p>
          {write ? (
            <Link href={newHref} className="mt-3 inline-block text-sm text-violet-400 hover:underline">
              Creează prima acțiune
            </Link>
          ) : null}
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
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/fleet/reminders/${row.id}`}
                      className="font-medium text-zinc-100 hover:text-white"
                    >
                      {row.title}
                    </Link>
                    <ReminderActionStatusBadge summary={row.summary} compact />
                    <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                      {reminderSourceLabel(row.sourceType)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {!vehicleId ? (
                      <>
                        <Link
                          href={`/fleet/vehicles/${row.vehicleId}`}
                          className="font-mono text-zinc-400 hover:text-zinc-200"
                        >
                          {row.registrationNumber}
                        </Link>
                        {" · "}
                      </>
                    ) : null}
                    {row.documentTypeCode
                      ? documentTypeLabel(row.documentTypeCode)
                      : row.linkedMaintenanceTitle
                        ? `Mentenanță: ${row.linkedMaintenanceTitle}`
                        : "Acțiune personalizată"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.reminderOffsetsDays?.map((d) => (
                      <span
                        key={`d-${d}`}
                        className="rounded border border-violet-900/50 px-1.5 py-0.5 text-[10px] text-violet-300/80"
                      >
                        {formatOffsetDaysLabel(d)}
                      </span>
                    ))}
                    {row.reminderOffsetsKm?.map((k) => (
                      <span
                        key={`k-${k}`}
                        className="rounded border border-sky-900/50 px-1.5 py-0.5 text-[10px] text-sky-300/80"
                      >
                        {formatOffsetKmLabel(k)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-right text-xs text-zinc-500">
                  {row.dueOn ? (
                    <p>
                      Scadență:{" "}
                      <span className="font-mono text-zinc-300">
                        {new Date(row.dueOn).toLocaleDateString("ro-RO")}
                      </span>
                    </p>
                  ) : null}
                  {row.dueOdometerKm != null ? (
                    <p>
                      Km țintă:{" "}
                      <span className="font-mono text-sky-300">{row.dueOdometerKm.toLocaleString("ro-RO")}</span>
                    </p>
                  ) : null}
                  {row.summary.nextRemindOn ? (
                    <p>
                      Următor:{" "}
                      <span className="font-mono text-violet-300">
                        {new Date(row.summary.nextRemindOn).toLocaleDateString("ro-RO")}
                      </span>
                    </p>
                  ) : null}
                  {write && row.sourceType !== "document" ? (
                    <DeleteReminderButton reminderId={row.id} title={row.title} />
                  ) : null}
                  {write && row.sourceType === "document" && row.vehicleDocumentId ? (
                    <Link
                      href={`/fleet/documents/${row.vehicleDocumentId}/edit`}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Editează document
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {!compact ? (
            <p className="text-xs text-zinc-600">{data.total} acțiuni · in-app (email — fază următoare)</p>
          ) : null}
        </div>
      ) : null}

      {!compact && write ? (
        <p className="mt-4">
          <Link href={backHref} className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Înapoi
          </Link>
        </p>
      ) : null}
    </>
  );
}

/** @deprecated Use RemindersListView */
export const DocumentRemindersView = RemindersListView;
