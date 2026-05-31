"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  { value: "all", label: "Toate" },
  { value: "action", label: "Necesită atenție" },
  { value: "upcoming", label: "Viitoare" },
  { value: "expired", label: "Depășite" },
] as const;

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (typeof j.message === "string") return j.message;
    if (Array.isArray(j.message)) return j.message.join(", ");
  } catch {
    /* plain text */
  }
  if (text.includes("ReminderAction") || text.includes("does not exist")) {
    return "Tabela ReminderAction lipsește în baza de date. Rulează migrarea: npx prisma migrate deploy (în folderul api).";
  }
  return text || `HTTP ${res.status}`;
}

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
  const searchKey = searchParams.toString();
  const urlStatus = searchParams.get("status");
  const [localStatus, setLocalStatus] = useState<string>("all");
  const status = (
    compact ? localStatus : urlStatus ?? "all"
  ) as (typeof STATUS_TABS)[number]["value"];

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams();
    q.set("page", searchParams.get("page") ?? "1");
    q.set("pageSize", compact ? "20" : "100");
    q.set("status", status);
    if (vehicleId) {
      q.set("vehicleId", vehicleId);
    } else {
      const reg = registrationNumber?.trim() || searchParams.get("registrationNumber")?.trim();
      if (reg) q.set("registrationNumber", reg);
      const clientId = searchParams.get("clientId")?.trim();
      if (clientId) q.set("clientId", clientId);
      const sourceType = searchParams.get("sourceType")?.trim();
      if (sourceType) q.set("sourceType", sourceType);
      const textQ = searchParams.get("q")?.trim();
      if (textQ) q.set("q", textQ);
      const dueFrom = searchParams.get("dueFrom")?.trim();
      if (dueFrom) q.set("dueFrom", dueFrom);
      const dueTo = searchParams.get("dueTo")?.trim();
      if (dueTo) q.set("dueTo", dueTo);
    }
    return q.toString();
  }, [status, vehicleId, registrationNumber, compact, searchKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reminders?${apiQuery}`);
      if (!res.ok) {
        setError(await parseApiError(res));
        setData(null);
        return;
      }
      setData((await res.json()) as Payload);
    } catch {
      setError("Nu am putut încărca reminderele. Verifică că API-ul rulează și migrarea DB e aplicată.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(next: string) {
    if (compact) {
      setLocalStatus(next);
      return;
    }
    const p = new URLSearchParams(searchParams.toString());
    p.set("status", next);
    router.replace(`/fleet/reminders?${p.toString()}`, { scroll: false });
  }

  const newHref = vehicleId
    ? `/fleet/reminders/new?vehicleId=${encodeURIComponent(vehicleId)}`
    : "/fleet/reminders/new";

  return (
    <>
      <div className={`mb-4 flex flex-wrap items-center gap-2 ${compact ? "" : "mb-6"}`}>
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
        {write ? (
          <Link
            href={newHref}
            className="ml-auto inline-flex rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
          >
            + Acțiune nouă
          </Link>
        ) : null}
      </div>

      {vehicleLabel ? (
        <p className="mb-4 text-sm text-zinc-400">
          Vehicul: <span className="font-mono text-zinc-200">{vehicleLabel}</span>
        </p>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">Se încarcă…</p> : null}
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && data?.items.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-8 text-center">
          <p className="text-zinc-300">Niciun reminder pentru filtrul „{STATUS_TABS.find((t) => t.value === status)?.label ?? status}”.</p>
          <p className="mt-2 text-xs text-zinc-500">Încearcă tab-ul „Toate” sau creează o acțiune nouă.</p>
          {write ? (
            <Link
              href={newHref}
              className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
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
                    <Link href={`/fleet/reminders/${row.id}`} className="font-medium text-zinc-100 hover:text-white">
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
                        : row.linkedCostCategory
                          ? `Cost: ${row.linkedCostCategory}`
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
                  {write && row.sourceType !== "document" && row.sourceType !== "maintenance" && row.sourceType !== "cost" ? (
                    <DeleteReminderButton
                      reminderId={row.id}
                      title={row.title}
                      onDeleted={() => void load()}
                    />
                  ) : null}
                  {write && row.sourceType === "document" && row.vehicleDocumentId ? (
                    <Link
                      href={`/fleet/documents/${row.vehicleDocumentId}/edit`}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Editează document
                    </Link>
                  ) : null}
                  {write && row.sourceType === "maintenance" && row.maintenanceEntryId ? (
                    <Link
                      href={`/fleet/maintenance/${row.maintenanceEntryId}/edit`}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Editează mentenanță
                    </Link>
                  ) : null}
                  {write && row.sourceType === "cost" && row.costEntryId ? (
                    <Link
                      href={`/fleet/costs/${row.costEntryId}/edit`}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Editează cost
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {!compact ? (
            <p className="text-xs text-zinc-600">{data.total} acțiuni în total pentru filtrul curent</p>
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

export const DocumentRemindersView = RemindersListView;
