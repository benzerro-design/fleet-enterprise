/**
 * Formatează o dată „calendar” din ISO (ex. perioadă FAZ 2026-01-31T23:59:59.999Z → 31.01.2026),
 * fără a muta ziua din cauza fusului orar la afișare.
 */
export function formatCalendarDateFromIso(iso: string, locale = "ro-RO"): string {
  const day = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale);
  }
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale);
}

export function formatPeriodRange(periodStart: string, periodEnd: string, locale = "ro-RO"): string {
  return `${formatCalendarDateFromIso(periodStart, locale)} – ${formatCalendarDateFromIso(periodEnd, locale)}`;
}
