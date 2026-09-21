import { FLEET_DISPLAY_TIMEZONE } from "@/lib/datetime-local";

export type AppointmentProposalSource = "manager" | "driver" | "supplier" | "admin";

type Props = {
  source: AppointmentProposalSource;
  scheduledAt: string | null | undefined;
  note?: string | null;
  /** Compact pentru inspector. */
  compact?: boolean;
};

function formatProposedWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO", {
    timeZone: FLEET_DISPLAY_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function proposalTitle(source: AppointmentProposalSource): string {
  switch (source) {
    case "driver":
      return "Propunere șofer";
    case "manager":
      return "Propunere manager";
    case "supplier":
      return "Propunere furnizor";
    case "admin":
      return "Propunere L*";
  }
}

function proposalFooter(
  source: AppointmentProposalSource,
  status?: string | null,
): string | null {
  if (status === "pending_fleet_peer") {
    return "Așteaptă confirmare în flotă";
  }
  switch (source) {
    case "driver":
    case "manager":
      return "Așteaptă validare furnizor";
    case "supplier":
      return "Așteaptă confirmare flotă";
    case "admin":
      return null;
  }
}

/** Callout vizual: cine a propus ziua/ora (nu doar o notă gri). */
export function AppointmentProposalCallout({
  source,
  scheduledAt,
  note,
  compact,
  status,
}: Props & { status?: string | null }) {
  const title = proposalTitle(source);
  const when = formatProposedWhen(scheduledAt);
  const noteText = note?.trim() || null;
  const footer = proposalFooter(source, status);

  /** Admin: doar eticheta „Propunere L*”. */
  if (source === "admin") {
    if (compact) {
      return (
        <div className="mt-1 rounded-lg border border-amber-700/50 bg-amber-950/35 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">{title}</p>
        </div>
      );
    }
    return (
      <div className="mt-2 w-full rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2.5">
        <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          {title}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="mt-1 rounded-lg border border-amber-700/50 bg-amber-950/35 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">{title}</p>
        <p className="mt-0.5 text-sm font-semibold text-amber-50">{when}</p>
        {noteText ? <p className="mt-1 text-[10px] text-amber-100/70">{noteText}</p> : null}
        {footer ? <p className="mt-1 text-[10px] text-amber-200/60">→ {footer.toLowerCase()}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 w-full rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          {title}
        </span>
        <span className="text-[11px] text-amber-200/70">a solicitat</span>
      </div>
      <p className="mt-1.5 text-base font-semibold tracking-tight text-amber-50">{when}</p>
      {noteText ? (
        <p className="mt-1 text-[11px] leading-snug text-amber-100/65">„{noteText}”</p>
      ) : null}
      {footer ? <p className="mt-1.5 text-[11px] text-amber-200/55">{footer}</p> : null}
    </div>
  );
}

/** @deprecated folosește AppointmentProposalCallout */
export function DriverProposalCallout(props: Omit<Props, "source">) {
  return <AppointmentProposalCallout {...props} source="driver" />;
}

export function appointmentProposalSource(appt: {
  fleetCounterProposedBy?: AppointmentProposalSource | null;
}): AppointmentProposalSource | null {
  const v = appt.fleetCounterProposedBy;
  return v === "manager" || v === "driver" || v === "supplier" || v === "admin" ? v : null;
}

export function isDriverCounterProposal(appt: {
  fleetCounterProposedBy?: AppointmentProposalSource | null;
}): boolean {
  return appt.fleetCounterProposedBy === "driver";
}

export function counterProposalStatusLabel(source: AppointmentProposalSource): string {
  switch (source) {
    case "driver":
      return "Șoferul a propus altă oră";
    case "manager":
      return "Managerul a propus altă oră";
    case "supplier":
      return "Furnizorul a propus altă oră";
    case "admin":
      return "Propunere L*";
  }
}
