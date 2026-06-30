export type OdometerTimelineReading = {
  id?: string;
  odometerKm: number;
  recordedAt: Date;
};

export type OdometerTimelineViolation = {
  severity: 'critical';
  message: string;
  earlierRecordedAt: string;
  earlierKm: number;
  laterRecordedAt: string;
  laterKm: number;
};

export type OdometerTimelineAnalysis = {
  /** Km din citirea cu cea mai recentă dată (nu maximul numeric). */
  currentKmFromTimeline: number | null;
  latestRecordedAt: string | null;
  violations: OdometerTimelineViolation[];
  hasCriticalViolations: boolean;
  isConsistent: boolean;
};

export type OdometerSyncSeverity = 'ok' | 'info' | 'warning' | 'critical';

export type OdometerEntryValidation = {
  severity: OdometerSyncSeverity;
  messages: string[];
  willUpdateCurrentKm: boolean;
  newCurrentKm: number;
  timelineAnalysis: OdometerTimelineAnalysis;
};

function sortReadingsAsc(readings: OdometerTimelineReading[]): OdometerTimelineReading[] {
  return [...readings].sort((a, b) => {
    const dt = a.recordedAt.getTime() - b.recordedAt.getTime();
    if (dt !== 0) return dt;
    return a.odometerKm - b.odometerKm;
  });
}

function formatRoDate(d: Date): string {
  return d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' });
}

function formatKm(km: number): string {
  return km.toLocaleString('ro-RO');
}

export function computeCurrentKmFromTimeline(readings: OdometerTimelineReading[]): number | null {
  if (readings.length === 0) return null;
  const asc = sortReadingsAsc(readings);
  return asc[asc.length - 1]!.odometerKm;
}

export function analyzeOdometerTimeline(readings: OdometerTimelineReading[]): OdometerTimelineAnalysis {
  const asc = sortReadingsAsc(readings);
  const violations: OdometerTimelineViolation[] = [];

  for (let i = 1; i < asc.length; i++) {
    const prev = asc[i - 1]!;
    const curr = asc[i]!;
    if (curr.odometerKm < prev.odometerKm) {
      violations.push({
        severity: 'critical',
        message:
          `Importanță majoră: pe ${formatRoDate(curr.recordedAt)} sunt înregistrați ${formatKm(curr.odometerKm)} km, ` +
          `dar pe ${formatRoDate(prev.recordedAt)} există deja ${formatKm(prev.odometerKm)} km. ` +
          `Odometrul nu poate scădea în timp — verificați datele sursă sau corectați citirile.`,
        earlierRecordedAt: prev.recordedAt.toISOString(),
        earlierKm: prev.odometerKm,
        laterRecordedAt: curr.recordedAt.toISOString(),
        laterKm: curr.odometerKm,
      });
    }
  }

  const latest = asc.length > 0 ? asc[asc.length - 1]! : null;

  return {
    currentKmFromTimeline: latest?.odometerKm ?? null,
    latestRecordedAt: latest?.recordedAt.toISOString() ?? null,
    violations,
    hasCriticalViolations: violations.length > 0,
    isConsistent: violations.length === 0,
  };
}

export function validateNewOdometerEntry(
  existing: OdometerTimelineReading[],
  newEntry: OdometerTimelineReading,
  storedCurrentKm: number,
): OdometerEntryValidation {
  const hypothetical = [...existing, newEntry];
  const timelineAnalysis = analyzeOdometerTimeline(hypothetical);
  const asc = sortReadingsAsc(hypothetical);
  const idx = asc.findIndex(
    (r) => r.recordedAt.getTime() === newEntry.recordedAt.getTime() && r.odometerKm === newEntry.odometerKm,
  );
  const entryIdx = idx >= 0 ? idx : asc.length - 1;

  const messages: string[] = [];
  let severity: OdometerSyncSeverity = 'ok';

  const prev = entryIdx > 0 ? asc[entryIdx - 1]! : null;
  const next = entryIdx < asc.length - 1 ? asc[entryIdx + 1]! : null;

  if (prev && newEntry.odometerKm < prev.odometerKm) {
    severity = 'critical';
    messages.push(
      `Importanță majoră: la data ${formatRoDate(newEntry.recordedAt)} km (${formatKm(newEntry.odometerKm)}) ` +
        `sunt sub citirea anterioară din ${formatRoDate(prev.recordedAt)} (${formatKm(prev.odometerKm)} km).`,
    );
  }

  if (next && newEntry.odometerKm > next.odometerKm) {
    severity = 'critical';
    messages.push(
      `Importanță majoră: la data ${formatRoDate(newEntry.recordedAt)} km (${formatKm(newEntry.odometerKm)}) ` +
        `depășesc citirea ulterioară din ${formatRoDate(next.recordedAt)} (${formatKm(next.odometerKm)} km).`,
    );
  }

  const newCurrentKm = timelineAnalysis.currentKmFromTimeline ?? storedCurrentKm;
  const willUpdateCurrentKm = newCurrentKm !== storedCurrentKm;

  const isLatestByDate =
    !next ||
    newEntry.recordedAt.getTime() >= new Date(timelineAnalysis.latestRecordedAt ?? 0).getTime();

  if (newEntry.odometerKm > storedCurrentKm && !isLatestByDate && severity !== 'critical') {
    severity = 'info';
    messages.push(
      `Km introdus (${formatKm(newEntry.odometerKm)}) depășește km curent vehicul (${formatKm(storedCurrentKm)}), ` +
        `dar data evenimentului este în trecut. Km curent vehicul rămâne cel din cea mai recentă citire cronologic ` +
        `(${formatKm(newCurrentKm)}${timelineAnalysis.latestRecordedAt ? `, ${formatRoDate(new Date(timelineAnalysis.latestRecordedAt))}` : ''}).`,
    );
  } else if (newEntry.odometerKm < storedCurrentKm && isLatestByDate && severity !== 'critical') {
    severity = 'warning';
    messages.push(
      `Km introdus (${formatKm(newEntry.odometerKm)}) este sub km curent (${formatKm(storedCurrentKm)}), ` +
        `dar data este cea mai recentă — km curent vehicul va fi actualizat la ${formatKm(newCurrentKm)}.`,
    );
  } else if (willUpdateCurrentKm && severity === 'ok') {
    severity = 'info';
    messages.push(
      `Km curent vehicul actualizat la ${formatKm(newCurrentKm)} (citirea cea mai recentă cronologic).`,
    );
  } else if (!willUpdateCurrentKm && severity === 'ok' && newEntry.odometerKm !== storedCurrentKm) {
    severity = 'info';
    messages.push(
      `Citire înregistrată în istoric. Km curent vehicul (${formatKm(storedCurrentKm)}) rămâne neschimbat — ` +
        `există citiri ulterioare cronologic.`,
    );
  }

  if (timelineAnalysis.hasCriticalViolations && severity !== 'critical') {
    severity = 'critical';
  }

  if (timelineAnalysis.hasCriticalViolations) {
    messages.push(
      'Acțiune recomandată: reconciliați citirile din istoric (corectați km sau datele evenimentelor) ' +
        'înainte de a folosi km curent pentru plan mentenanță sau rapoarte.',
    );
  }

  return {
    severity,
    messages,
    willUpdateCurrentKm,
    newCurrentKm,
    timelineAnalysis,
  };
}

export function buildOdometerSyncPrimaryMessage(
  validation: OdometerEntryValidation,
  previousKm: number,
): string {
  if (validation.severity === 'critical') {
    return validation.messages[0] ?? 'Inconsistență majoră dată/km în istoricul odometrului.';
  }
  if (validation.willUpdateCurrentKm) {
    return `Km curent vehicul actualizat: ${formatKm(previousKm)} → ${formatKm(validation.newCurrentKm)} (pe baza celei mai recente citiri cronologic).`;
  }
  return (
    validation.messages[0] ??
    `Citire odometru înregistrată. Km curent vehicul: ${formatKm(validation.newCurrentKm)}.`
  );
}
