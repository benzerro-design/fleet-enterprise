import {
  computeReminderSummary,
  normalizeReminderOffsets,
  type DocumentReminderSummary,
  type ReminderListFilterStatus,
} from "./document-reminders";

export const REMINDER_OFFSET_KM_CHOICES = [20000, 10000, 5000, 3000, 1000, 500] as const;

export const REMINDER_SOURCE_TYPES = [
  { value: "document", label: "Document" },
  { value: "maintenance", label: "Mentenanță" },
  { value: "cost", label: "Cost" },
  { value: "custom", label: "Personalizat" },
] as const;

export type ReminderSourceType = (typeof REMINDER_SOURCE_TYPES)[number]["value"];

export type ReminderActionStatus =
  | "inactive"
  | "no_constraints"
  | "expired"
  | "due_today"
  | "due_soon"
  | "scheduled"
  | "km_overdue"
  | "km_due_soon"
  | "ok";

export type KmTimelineEntry = {
  offsetKm: number;
  remindAtKm: number;
  status: "past" | "today" | "upcoming";
};

export type ReminderActionSummary = {
  status: ReminderActionStatus;
  time: DocumentReminderSummary | null;
  nextRemindOn: string | null;
  nextOffsetDays: number | null;
  daysUntilNextReminder: number | null;
  daysUntilDue: number | null;
  nextRemindAtKm: number | null;
  nextOffsetKm: number | null;
  kmUntilNextReminder: number | null;
  kmUntilDue: number | null;
  kmTimeline: KmTimelineEntry[];
};

export type ReminderActionRow = {
  id: string;
  tenantSlug: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  vehicleOdometerKm: number;
  sourceType: ReminderSourceType;
  title: string;
  notes: string | null;
  vehicleDocumentId: string | null;
  maintenanceEntryId: string | null;
  costEntryId: string | null;
  documentTypeCode: string | null;
  linkedMaintenanceTitle: string | null;
  linkedCostCategory: string | null;
  dueOn: string | null;
  reminderOffsetsDays: number[] | null;
  dueOdometerKm: number | null;
  reminderOffsetsKm: number[] | null;
  intervalDays: number | null;
  intervalKm: number | null;
  lastPerformedOn: string | null;
  lastPerformedOdometerKm: number | null;
  isActive: boolean;
  summary: ReminderActionSummary;
  createdAt: string;
  updatedAt: string;
};

export function reminderSourceLabel(sourceType: ReminderSourceType): string {
  return REMINDER_SOURCE_TYPES.find((x) => x.value === sourceType)?.label ?? sourceType;
}

export function normalizeReminderOffsetsKm(raw: unknown): number[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const nums = raw
    .filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 500_000)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  if (nums.length === 0) return null;
  if (nums.length > 10) return null;
  return nums.sort((a, b) => b - a);
}

function computeKmSummary(
  dueOdometerKm: number | null | undefined,
  reminderOffsetsKm: unknown,
  currentOdometerKm: number | null | undefined,
): Pick<
  ReminderActionSummary,
  "nextRemindAtKm" | "nextOffsetKm" | "kmUntilNextReminder" | "kmUntilDue" | "kmTimeline" | "status"
> {
  const odometer = currentOdometerKm ?? 0;
  const offsets = normalizeReminderOffsetsKm(reminderOffsetsKm);
  const empty = {
    nextRemindAtKm: null,
    nextOffsetKm: null,
    kmUntilNextReminder: null,
    kmUntilDue: null,
    kmTimeline: [] as KmTimelineEntry[],
    status: "ok" as ReminderActionStatus,
  };
  if (dueOdometerKm == null) return empty;
  const kmUntilDue = dueOdometerKm - odometer;
  if (!offsets?.length) {
    return { ...empty, kmUntilDue, status: kmUntilDue < 0 ? "km_overdue" : "ok" };
  }
  const kmTimeline: KmTimelineEntry[] = offsets.map((offsetKm) => {
    const remindAtKm = dueOdometerKm - offsetKm;
    let status: KmTimelineEntry["status"] = "upcoming";
    if (odometer > remindAtKm) status = "past";
    else if (odometer === remindAtKm) status = "today";
    return { offsetKm, remindAtKm, status };
  });
  if (kmUntilDue < 0) {
    return {
      nextRemindAtKm: null,
      nextOffsetKm: null,
      kmUntilNextReminder: null,
      kmUntilDue,
      kmTimeline,
      status: "km_overdue",
    };
  }
  const todayKm = kmTimeline.find((t) => t.status === "today");
  if (todayKm) {
    return {
      nextRemindAtKm: todayKm.remindAtKm,
      nextOffsetKm: todayKm.offsetKm,
      kmUntilNextReminder: 0,
      kmUntilDue,
      kmTimeline,
      status: "due_today",
    };
  }
  const upcoming = kmTimeline.filter((t) => t.status === "upcoming").sort((a, b) => a.remindAtKm - b.remindAtKm);
  const next = upcoming[0] ?? null;
  if (!next) {
    return {
      nextRemindAtKm: null,
      nextOffsetKm: null,
      kmUntilNextReminder: null,
      kmUntilDue,
      kmTimeline,
      status: kmUntilDue <= 1000 ? "km_due_soon" : "ok",
    };
  }
  const kmUntilNextReminder = next.remindAtKm - odometer;
  return {
    nextRemindAtKm: next.remindAtKm,
    nextOffsetKm: next.offsetKm,
    kmUntilNextReminder,
    kmUntilDue,
    kmTimeline,
    status: kmUntilNextReminder <= 500 ? "km_due_soon" : "scheduled",
  };
}

function mergeStatuses(
  timeStatus: DocumentReminderSummary["status"],
  kmStatus: ReminderActionStatus,
): ReminderActionStatus {
  const priority: ReminderActionStatus[] = [
    "inactive",
    "no_constraints",
    "expired",
    "km_overdue",
    "due_today",
    "due_soon",
    "km_due_soon",
    "scheduled",
    "ok",
  ];
  const timeMapped: ReminderActionStatus =
    timeStatus === "no_expiry" || timeStatus === "no_reminders"
      ? "no_constraints"
      : timeStatus === "expired"
        ? "expired"
        : timeStatus === "due_today"
          ? "due_today"
          : timeStatus === "due_soon"
            ? "due_soon"
            : timeStatus === "scheduled"
              ? "scheduled"
              : "ok";
  const pick = (a: ReminderActionStatus, b: ReminderActionStatus) =>
    priority.indexOf(a) <= priority.indexOf(b) ? a : b;
  if (timeMapped === "no_constraints") return kmStatus;
  if (kmStatus === "ok" || kmStatus === "scheduled" || kmStatus === "no_constraints") return timeMapped;
  return pick(timeMapped, kmStatus);
}

export function computeReminderActionSummary(
  input: {
    isActive: boolean;
    dueOn: Date | string | null | undefined;
    reminderOffsetsDays: unknown;
    dueOdometerKm: number | null | undefined;
    reminderOffsetsKm: unknown;
  },
  vehicleOdometerKm: number | null | undefined,
  referenceDate: Date = new Date(),
): ReminderActionSummary {
  if (!input.isActive) {
    return {
      status: "inactive",
      time: null,
      nextRemindOn: null,
      nextOffsetDays: null,
      daysUntilNextReminder: null,
      daysUntilDue: null,
      nextRemindAtKm: null,
      nextOffsetKm: null,
      kmUntilNextReminder: null,
      kmUntilDue: null,
      kmTimeline: [],
    };
  }
  const hasTime = Boolean(input.dueOn);
  const hasKm = input.dueOdometerKm != null;
  const offsetsDays = normalizeReminderOffsets(input.reminderOffsetsDays);
  const time = hasTime ? computeReminderSummary(input.dueOn, offsetsDays, referenceDate) : null;
  const kmPart = hasKm
    ? computeKmSummary(input.dueOdometerKm, input.reminderOffsetsKm, vehicleOdometerKm)
    : {
        nextRemindAtKm: null,
        nextOffsetKm: null,
        kmUntilNextReminder: null,
        kmUntilDue: null,
        kmTimeline: [] as KmTimelineEntry[],
        status: "no_constraints" as ReminderActionStatus,
      };
  if (!hasTime && !hasKm) {
    return {
      status: "no_constraints",
      time: null,
      nextRemindOn: null,
      nextOffsetDays: null,
      daysUntilNextReminder: null,
      daysUntilDue: null,
      nextRemindAtKm: null,
      nextOffsetKm: null,
      kmUntilNextReminder: null,
      kmUntilDue: null,
      kmTimeline: [],
    };
  }
  const timeMapped: ReminderActionStatus =
    !time || time.status === "no_expiry" || time.status === "no_reminders"
      ? "no_constraints"
      : time.status === "expired"
        ? "expired"
        : time.status === "due_today"
          ? "due_today"
          : time.status === "due_soon"
            ? "due_soon"
            : time.status === "scheduled"
              ? "scheduled"
              : "ok";
  const status = !hasTime ? kmPart.status : !hasKm ? timeMapped : mergeStatuses(time?.status ?? "no_expiry", kmPart.status);
  return {
    status,
    time,
    nextRemindOn: time?.nextRemindOn ?? null,
    nextOffsetDays: time?.nextOffsetDays ?? null,
    daysUntilNextReminder: time?.daysUntilNextReminder ?? null,
    daysUntilDue: time?.daysUntilExpiry ?? null,
    nextRemindAtKm: kmPart.nextRemindAtKm,
    nextOffsetKm: kmPart.nextOffsetKm,
    kmUntilNextReminder: kmPart.kmUntilNextReminder,
    kmUntilDue: kmPart.kmUntilDue,
    kmTimeline: kmPart.kmTimeline,
  };
}

export function reminderActionStatusMeta(status: ReminderActionStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "due_today":
      return { label: "Azi", className: "border-amber-500/50 bg-amber-950/40 text-amber-200" };
    case "due_soon":
    case "km_due_soon":
      return { label: "Curând", className: "border-orange-500/40 bg-orange-950/30 text-orange-200" };
    case "expired":
    case "km_overdue":
      return { label: "Depășit", className: "border-red-500/40 bg-red-950/30 text-red-200" };
    case "scheduled":
      return { label: "Programat", className: "border-violet-500/40 bg-violet-950/30 text-violet-200" };
    case "inactive":
      return { label: "Inactiv", className: "border-zinc-700 bg-zinc-900/60 text-zinc-500" };
    case "no_constraints":
      return { label: "Fără termen", className: "border-zinc-700 bg-zinc-900/60 text-zinc-500" };
    default:
      return { label: "OK", className: "border-emerald-800/50 bg-emerald-950/30 text-emerald-300" };
  }
}

export function formatOffsetKmLabel(offsetKm: number): string {
  if (offsetKm === 0) return "La km țintă";
  if (offsetKm >= 1000) return `${(offsetKm / 1000).toLocaleString("ro-RO")}k km înainte`;
  return `${offsetKm.toLocaleString("ro-RO")} km înainte`;
}

export function matchesActionReminderFilter(
  summary: ReminderActionSummary,
  filter: ReminderListFilterStatus,
): boolean {
  if (summary.status === "inactive") return false;
  switch (filter) {
    case "all":
      return summary.status !== "no_constraints";
    case "action":
      return (
        summary.status === "due_today" ||
        summary.status === "due_soon" ||
        summary.status === "expired" ||
        summary.status === "km_overdue" ||
        summary.status === "km_due_soon"
      );
    case "upcoming":
      return summary.status === "scheduled" || summary.status === "due_soon" || summary.status === "km_due_soon";
    case "expired":
      return summary.status === "expired" || summary.status === "km_overdue";
    default:
      return true;
  }
}

export const CUSTOM_REMINDER_PRESETS = [
  { label: "Schimb distribuție", title: "Schimb distribuție", intervalKm: 90000 },
  { label: "Lichid frână", title: "Schimb lichid de frână", intervalKm: 60000 },
  { label: "Revizie periodică", title: "Revizie periodică", intervalDays: 365, intervalKm: 15000 },
] as const;
