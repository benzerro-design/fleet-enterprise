const INTAKE_JSON_PREFIX = '{"v":';

export type TireRimCondition = "ok" | "scratched" | "damaged";

const RIM_CONDITIONS = new Set<TireRimCondition>(["ok", "scratched", "damaged"]);

const RIM_LABELS: Record<TireRimCondition, string> = {
  ok: "OK",
  scratched: "Zgâriate",
  damaged: "Deteriorate",
};

const WHEEL_POS_LABELS: Record<string, string> = {
  fl: "FL",
  fr: "FR",
  rl: "RL",
  rr: "RR",
};

function parseRimCondition(raw: unknown): TireRimCondition | undefined {
  if (typeof raw !== "string") return undefined;
  return RIM_CONDITIONS.has(raw as TireRimCondition) ? (raw as TireRimCondition) : undefined;
}

type ParsedIntakeNotes = {
  lines: string[];
};

function parseStructuredIntakeNotes(raw: string): ParsedIntakeNotes | null {
  if (!raw.startsWith(INTAKE_JSON_PREFIX)) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const lines: string[] = [];
    const flags: string[] = [];
    if (o.wearUniform === true) flags.push("uzură uniformă");
    if (o.wearUniform === false) flags.push("uzură neuniformă");
    if (o.cracks === true) flags.push("crăpături");
    if (o.cracks === false) flags.push("fără crăpături");
    if (flags.length) lines.push(flags.join(" · "));

    if (o.v === 2 && Array.isArray(o.assets)) {
      const treadParts: string[] = [];
      for (const row of o.assets) {
        if (!row || typeof row !== "object" || Array.isArray(row)) continue;
        const assetId =
          typeof (row as { assetId?: unknown }).assetId === "string"
            ? (row as { assetId: string }).assetId.trim()
            : "";
        const tread = (row as { treadMm?: unknown }).treadMm;
        if (!assetId || typeof tread !== "number" || !Number.isFinite(tread)) continue;
        treadParts.push(`${assetId.slice(0, 8)}… ${tread} mm`);
      }
      if (treadParts.length) lines.push(`Profil: ${treadParts.join("; ")}`);
    } else if (o.v === 1 && o.treadMm && typeof o.treadMm === "object" && !Array.isArray(o.treadMm)) {
      const treadRaw = o.treadMm as Record<string, unknown>;
      const treadParts: string[] = [];
      for (const pos of ["fl", "fr", "rl", "rr"] as const) {
        const v = treadRaw[pos];
        if (typeof v === "number" && Number.isFinite(v)) {
          treadParts.push(`${WHEEL_POS_LABELS[pos]} ${v} mm`);
        }
      }
      if (treadParts.length) lines.push(`Profil: ${treadParts.join("; ")}`);
    }

    const rimCondition = parseRimCondition(o.rimCondition);
    const rimNotes =
      typeof o.rimNotes === "string" && o.rimNotes.trim() ? o.rimNotes.trim() : undefined;
    if (rimCondition) {
      const rimLine = `Jante: ${RIM_LABELS[rimCondition]}`;
      lines.push(rimNotes ? `${rimLine} — ${rimNotes}` : rimLine);
    } else if (rimNotes) {
      lines.push(`Jante: ${rimNotes}`);
    }

    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    if (summary) lines.push(summary);

    return lines.length ? { lines } : { lines: ["Recepție structurată (fără detalii)"] };
  } catch {
    return null;
  }
}

/** Human-readable profil + rim summary for stored intakeTreadNotes (v1/v2 JSON or legacy text). */
export function formatIntakeTreadNotesDisplay(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const structured = parseStructuredIntakeNotes(s);
  if (structured) return structured.lines.join("\n");
  return s;
}

export function tireRimConditionLabel(condition: TireRimCondition): string {
  return RIM_LABELS[condition];
}

export const TIRE_RIM_CONDITION_OPTIONS: Array<{ value: TireRimCondition; label: string }> = [
  { value: "ok", label: RIM_LABELS.ok },
  { value: "scratched", label: RIM_LABELS.scratched },
  { value: "damaged", label: RIM_LABELS.damaged },
];
