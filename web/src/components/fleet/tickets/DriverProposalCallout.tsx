import { formatAppointmentSlot } from "@/lib/appointments-api";

type Props = {
  scheduledAt: string | null | undefined;
  note?: string | null;
  /** Compact pentru inspector. */
  compact?: boolean;
};

/** Callout vizual: șoferul a solicitat ziua/ora (nu doar o notă gri). */
export function DriverProposalCallout({ scheduledAt, note, compact }: Props) {
  const when = formatAppointmentSlot(scheduledAt);
  const noteText = note?.trim() || null;

  if (compact) {
    return (
      <div className="mt-1 rounded-lg border border-amber-700/50 bg-amber-950/35 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
          Propunere șofer
        </p>
        <p className="mt-0.5 text-sm font-semibold text-amber-50">{when}</p>
        {noteText ? <p className="mt-1 text-[10px] text-amber-100/70">{noteText}</p> : null}
        <p className="mt-1 text-[10px] text-amber-200/60">→ așteaptă validare furnizor</p>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          Propunere șofer
        </span>
        <span className="text-[11px] text-amber-200/70">a solicitat</span>
      </div>
      <p className="mt-1.5 text-base font-semibold tracking-tight text-amber-50">{when}</p>
      {noteText ? (
        <p className="mt-1 text-[11px] leading-snug text-amber-100/65">„{noteText}”</p>
      ) : null}
      <p className="mt-1.5 text-[11px] text-amber-200/55">Așteaptă validare furnizor</p>
    </div>
  );
}

export function isDriverCounterProposal(appt: {
  fleetCounterProposedBy?: "manager" | "driver" | null;
}): boolean {
  return appt.fleetCounterProposedBy === "driver";
}
