const HOUR_START = 7;
const HOUR_END = 20;
export const PX_PER_HOUR = 48;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 4);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const y = weekStart.getFullYear();
  return `${weekStart.toLocaleDateString("ro-RO", opts)} – ${end.toLocaleDateString("ro-RO", { ...opts, year: end.getMonth() < weekStart.getMonth() ? "numeric" : undefined })} ${y}`;
}

export function dayLabels(weekStart: Date): Array<{ date: Date; label: string; short: string }> {
  return Array.from({ length: 5 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      label: date.toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short" }),
      short: date.toLocaleDateString("ro-RO", { weekday: "short" }),
    };
  });
}

export function calendarRangeIso(weekStart: Date): { from: string; to: string } {
  const from = startOfDay(weekStart);
  const to = addDays(startOfDay(weekStart), 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function topOffsetForTime(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, (h - HOUR_START) * PX_PER_HOUR);
}

export function heightForDuration(durationMin: number): number {
  return Math.max(24, (durationMin / 60) * PX_PER_HOUR - 4);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const SCHEDULER_HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

export function gridHeightPx(): number {
  return (HOUR_END - HOUR_START) * PX_PER_HOUR;
}
