import type { BotDivision } from './bot.types';

/** Diviziuni demo — mapare cod client din seed. */
export const BOT_DEMO_DIVISIONS: Record<
  BotDivision,
  { label: string; clientCodes: string[] }
> = {
  alpha: { label: 'Client Alpha', clientCodes: ['Client Alpha'] },
  beta: { label: 'Client Beta', clientCodes: ['Client Beta'] },
  tenant_wide: { label: 'Tot tenant-ul demo', clientCodes: ['Client Alpha', 'Client Beta'] },
};

export function divisionClientCodes(division: BotDivision): string[] {
  return BOT_DEMO_DIVISIONS[division].clientCodes;
}

/** PRNG determinist pentru reproductibilitate (LCG). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function botRef(sessionId: string, moduleId: string, index: number): string {
  const short = sessionId.slice(-6).toUpperCase();
  return `BOT-${moduleId.toUpperCase().slice(0, 4)}-${short}-${String(index).padStart(3, '0')}`;
}

export function daysAgoFromSeed(seed: number, daysBack: number, hour = 8): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(hour, 0, 0, 0);
  const jitter = Math.floor(seededRandom(seed + daysBack)() * 120);
  d.setUTCMinutes(jitter % 60);
  return d;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
