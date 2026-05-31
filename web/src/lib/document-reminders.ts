/** Opțiuni standard de offset (zile înainte de expirare). 0 = ziua expirării. */
export const REMINDER_OFFSET_CHOICES = [90, 60, 30, 14, 7, 3, 1, 0] as const;

export type ReminderPresetId = 'standard' | 'itp_rca' | 'urgent' | 'minimal' | 'custom';

export const REMINDER_PRESETS: ReadonlyArray<{
  id: ReminderPresetId;
  label: string;
  description: string;
  offsets: readonly number[];
}> = [
  {
    id: 'standard',
    label: 'Standard flotă',
    description: '60, 30 și 7 zile înainte',
    offsets: [60, 30, 7],
  },
  {
    id: 'itp_rca',
    label: 'ITP / RCA / CASCO',
    description: '30, 14, 7 zile și în ziua expirării',
    offsets: [30, 14, 7, 1, 0],
  },
  {
    id: 'urgent',
    label: 'Doar urgent',
    description: '7 zile, 3 zile și ziua expirării',
    offsets: [7, 3, 0],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Doar cu 7 zile înainte',
    offsets: [7],
  },
];

export const DEFAULT_REMINDER_OFFSETS: number[] = [...REMINDER_PRESETS[0].offsets];

export type ReminderTimelineStatus =
  | 'no_expiry'
  | 'no_reminders'
  | 'expired'
  | 'due_today'
  | 'due_soon'
  | 'scheduled'
  | 'ok';

export type ReminderTimelineEntry = {
  offsetDays: number;
  remindOn: string;
  status: 'past' | 'today' | 'upcoming';
};

export type DocumentReminderSummary = {
  status: ReminderTimelineStatus;
  /** Următorul reminder relevant (inclusiv astăzi). */
  nextRemindOn: string | null;
  nextOffsetDays: number | null;
  daysUntilNextReminder: number | null;
  daysUntilExpiry: number | null;
  timeline: ReminderTimelineEntry[];
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function diffUtcDays(a: Date, b: Date): number {
  const ms = startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function normalizeReminderOffsets(raw: unknown): number[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const nums = raw
    .filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 365)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  if (nums.length === 0) return null;
  if (nums.length > 10) return null;
  return nums.sort((a, b) => b - a);
}

export function offsetsFromPreset(presetId: string): number[] | null {
  const p = REMINDER_PRESETS.find((x) => x.id === presetId);
  return p ? [...p.offsets] : null;
}

export function detectPresetFromOffsets(offsets: number[] | null | undefined): ReminderPresetId {
  if (!offsets?.length) return 'custom';
  const key = [...offsets].sort((a, b) => b - a).join(',');
  for (const p of REMINDER_PRESETS) {
    const pk = [...p.offsets].sort((a, b) => b - a).join(',');
    if (pk === key) return p.id;
  }
  return 'custom';
}

export function computeReminderSummary(
  expiresOn: Date | string | null | undefined,
  reminderOffsetsDays: unknown,
  referenceDate: Date = new Date(),
): DocumentReminderSummary {
  const today = startOfUtcDay(referenceDate);
  const offsets = normalizeReminderOffsets(reminderOffsetsDays);

  if (!expiresOn) {
    return {
      status: 'no_expiry',
      nextRemindOn: null,
      nextOffsetDays: null,
      daysUntilNextReminder: null,
      daysUntilExpiry: null,
      timeline: [],
    };
  }

  const expiry = startOfUtcDay(new Date(expiresOn));
  const daysUntilExpiry = diffUtcDays(expiry, today);

  if (!offsets?.length) {
    return {
      status: daysUntilExpiry < 0 ? 'expired' : 'no_reminders',
      nextRemindOn: null,
      nextOffsetDays: null,
      daysUntilNextReminder: null,
      daysUntilExpiry,
      timeline: [],
    };
  }

  const timeline: ReminderTimelineEntry[] = offsets.map((offsetDays) => {
    const remindOn = addUtcDays(expiry, -offsetDays);
    const delta = diffUtcDays(remindOn, today);
    let status: ReminderTimelineEntry['status'] = 'upcoming';
    if (delta < 0) status = 'past';
    else if (delta === 0) status = 'today';
    return { offsetDays, remindOn: remindOn.toISOString(), status };
  });

  if (daysUntilExpiry < 0) {
    return {
      status: 'expired',
      nextRemindOn: null,
      nextOffsetDays: null,
      daysUntilNextReminder: null,
      daysUntilExpiry,
      timeline,
    };
  }

  const todayEntry = timeline.find((t) => t.status === 'today');
  if (todayEntry) {
    return {
      status: 'due_today',
      nextRemindOn: todayEntry.remindOn,
      nextOffsetDays: todayEntry.offsetDays,
      daysUntilNextReminder: 0,
      daysUntilExpiry,
      timeline,
    };
  }

  const upcoming = timeline
    .filter((t) => t.status === 'upcoming')
    .sort((a, b) => new Date(a.remindOn).getTime() - new Date(b.remindOn).getTime());

  const next = upcoming[0] ?? null;
  if (!next) {
    return {
      status: daysUntilExpiry <= 7 ? 'due_soon' : 'ok',
      nextRemindOn: null,
      nextOffsetDays: null,
      daysUntilNextReminder: null,
      daysUntilExpiry,
      timeline,
    };
  }

  const daysUntilNextReminder = diffUtcDays(new Date(next.remindOn), today);
  const status: ReminderTimelineStatus =
    daysUntilNextReminder <= 3 ? 'due_soon' : 'scheduled';

  return {
    status,
    nextRemindOn: next.remindOn,
    nextOffsetDays: next.offsetDays,
    daysUntilNextReminder,
    daysUntilExpiry,
    timeline,
  };
}

export type ReminderListFilterStatus = 'all' | 'action' | 'upcoming' | 'expired';

export function matchesReminderListFilter(
  summary: DocumentReminderSummary,
  filter: ReminderListFilterStatus,
): boolean {
  switch (filter) {
    case 'all':
      return summary.status !== 'no_expiry' && summary.status !== 'no_reminders';
    case 'action':
      return summary.status === 'due_today' || summary.status === 'due_soon' || summary.status === 'expired';
    case 'upcoming':
      return summary.status === 'scheduled' || summary.status === 'due_soon';
    case 'expired':
      return summary.status === 'expired';
    default:
      return true;
  }
}

export function formatOffsetDaysLabel(days: number): string {
  if (days === 0) return "Ziua expirării";
  if (days === 1) return "1 zi înainte";
  return `${days} zile înainte`;
}

export function reminderStatusMeta(status: ReminderTimelineStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "expired":
      return { label: "Expirat", className: "border-red-900/60 bg-red-950/50 text-red-200" };
    case "due_today":
      return { label: "Reminder azi", className: "border-amber-500/50 bg-amber-950/60 text-amber-100" };
    case "due_soon":
      return { label: "Reminder curând", className: "border-amber-900/60 bg-amber-950/50 text-amber-200" };
    case "scheduled":
      return { label: "Programat", className: "border-violet-900/60 bg-violet-950/50 text-violet-200" };
    case "ok":
      return { label: "OK", className: "border-emerald-900/60 bg-emerald-950/50 text-emerald-200" };
    case "no_reminders":
      return { label: "Fără remindere", className: "border-zinc-700 bg-zinc-900/60 text-zinc-400" };
    default:
      return { label: "—", className: "border-zinc-700 bg-zinc-900/60 text-zinc-400" };
  }
}
