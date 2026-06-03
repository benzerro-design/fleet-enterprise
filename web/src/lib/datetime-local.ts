/** Fus pentru afișare în UI (liste/detaliu pe server Cloud Run = UTC implicit). */
export const FLEET_DISPLAY_TIMEZONE = "Europe/Bucharest";

/** ISO UTC → text ro-RO în ora României (liste, detaliu curse). */
export function formatDateTimeRo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", {
    timeZone: FLEET_DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Convertește ISO (UTC) la valoare pentru `<input type="datetime-local">` în fusul local al browserului. */
export function toDatetimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Citește datetime-local ca dată/oră locală și trimite ISO UTC la API. */
export function toIsoFromDatetimeLocal(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
