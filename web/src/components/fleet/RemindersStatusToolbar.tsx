"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export const REMINDER_STATUS_TABS = [
  { value: "all", label: "Toate" },
  { value: "action", label: "Necesită atenție" },
  { value: "upcoming", label: "Viitoare" },
  { value: "expired", label: "Depășite" },
] as const;

type RemindersStatusToolbarProps = {
  write?: boolean;
  vehicleId?: string;
  /** Pe fișa vehiculului — status local, fără URL. */
  compact?: boolean;
  status?: string;
  onStatusChange?: (status: string) => void;
};

export function RemindersStatusToolbar({
  write = false,
  vehicleId,
  compact = false,
  status: controlledStatus,
  onStatusChange,
}: RemindersStatusToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get("status");
  const status = controlledStatus ?? (compact ? "all" : urlStatus ?? "all");

  function setStatus(next: string) {
    if (onStatusChange) {
      onStatusChange(next);
      return;
    }
    if (compact) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("status", next);
    router.replace(`/fleet/reminders?${p.toString()}`, { scroll: false });
  }

  const newHref = vehicleId
    ? `/fleet/reminders/new?vehicleId=${encodeURIComponent(vehicleId)}`
    : "/fleet/reminders/new";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REMINDER_STATUS_TABS.map((tab) => (
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
  );
}
