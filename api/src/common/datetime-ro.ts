/** Afișare date/ore în evenimente tichet — fus România (Cloud Run = UTC). */
export const FLEET_DISPLAY_TIMEZONE = 'Europe/Bucharest';

export function formatRoDateTime(value: Date | string | null | undefined): string {
  if (value == null) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ro-RO', {
    timeZone: FLEET_DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
