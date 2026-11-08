/** Format client code + legal name without repeating when they match. */

export function formatClientDisplay(
  code: string | null | undefined,
  legalName?: string | null,
): string {
  const c = (code ?? "").trim();
  const n = (legalName ?? "").trim();
  if (!c && !n) return "—";
  if (!n) return c || "—";
  if (!c) return n;
  if (c.toLocaleLowerCase("ro") === n.toLocaleLowerCase("ro")) return c;
  return `${c} — ${n}`;
}

/** Header line: "Client {label}" — omit paren when code === legal name. */
export function formatClientHeaderParts(
  code: string | null | undefined,
  legalName?: string | null,
): { primary: string; secondary: string | null } {
  const c = (code ?? "").trim();
  const n = (legalName ?? "").trim();
  if (!c && !n) return { primary: "—", secondary: null };
  if (!n) return { primary: c || "—", secondary: null };
  if (!c) return { primary: n, secondary: null };
  if (c.toLocaleLowerCase("ro") === n.toLocaleLowerCase("ro")) {
    return { primary: c, secondary: null };
  }
  return { primary: c, secondary: n };
}
