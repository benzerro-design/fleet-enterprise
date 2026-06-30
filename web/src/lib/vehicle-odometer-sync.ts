export type VehicleOdometerSyncPayload = {
  updated: boolean;
  previousKm: number;
  newKm: number;
  message: string;
  severity: "ok" | "info" | "warning" | "critical";
  messages: string[];
  timelineConsistent: boolean;
  readingCreated: boolean;
};

export function parseOdometerInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

export type OdometerTimelineViolation = {
  severity: "critical";
  message: string;
  earlierRecordedAt: string;
  earlierKm: number;
  laterRecordedAt: string;
  laterKm: number;
};

export type OdometerTimelineAnalysis = {
  currentKmFromTimeline: number | null;
  latestRecordedAt: string | null;
  violations: OdometerTimelineViolation[];
  hasCriticalViolations: boolean;
  isConsistent: boolean;
};

export function severityBorderClass(severity: VehicleOdometerSyncPayload["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-rose-900/50 bg-rose-950/30 text-rose-100";
    case "warning":
      return "border-amber-900/40 bg-amber-950/25 text-amber-200";
    case "info":
      return "border-sky-900/40 bg-sky-950/25 text-sky-200";
    default:
      return "border-sky-900/40 bg-sky-950/25 text-sky-200";
  }
}
