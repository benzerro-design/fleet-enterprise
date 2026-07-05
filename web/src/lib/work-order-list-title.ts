/** Primul cuvânt din text — pentru titlu compact în listă. */
export function workOrderListTitleShort(text: string | null | undefined): string {
  if (!text?.trim()) return "—";
  const word = text.trim().split(/\s+/)[0];
  return word || "—";
}

/** Subiect complet pentru tooltip (tichet → fallback titlu WO). */
export function workOrderListTitleFull(
  ticketSubject: string | null | undefined,
  woTitle: string,
): string {
  return ticketSubject?.trim() || woTitle.trim() || "—";
}
