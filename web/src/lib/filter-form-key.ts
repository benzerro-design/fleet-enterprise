/** Params păstrate la reset (tab, highlight) — nu intră în key-ul formularului. */
const FILTER_FORM_SKIP = new Set(["page", "view", "generated"]);

/**
 * Key pentru remount formulare GET: `defaultValue` nu se actualizează la navigare client
 * pe aceeași pagină fără remount.
 */
export function filterFormKey(sp: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const k of Object.keys(sp).sort()) {
    if (FILTER_FORM_SKIP.has(k)) continue;
    const v = sp[k]?.trim();
    if (v) p.set(k, v);
  }
  return p.toString() || "_";
}
