/** Coduri stabile pentru alocarea costurilor la mentenanță (API + DB). */
export const MAINTENANCE_COST_ALLOCATION_CODES = [
  'revizie',
  'itp',
  'reparatie_mecanica',
  'reparatie_electrica',
  'dauna',
  'service_roti',
  'diagnoza',
  'tinichigerie',
  'altele',
] as const;

export type MaintenanceCostAllocationCode = (typeof MAINTENANCE_COST_ALLOCATION_CODES)[number];

const SET = new Set<string>(MAINTENANCE_COST_ALLOCATION_CODES);

export function isMaintenanceCostAllocationCode(v: string): v is MaintenanceCostAllocationCode {
  return SET.has(v);
}

/** Etichete afișate în UI (RO) — aliniate cu web/src/lib/maintenance-cost-allocation.ts */
export const MAINTENANCE_COST_ALLOCATION_LABELS: Record<MaintenanceCostAllocationCode, string> = {
  revizie: 'Revizie',
  itp: 'ITP',
  reparatie_mecanica: 'Reparație mecanică',
  reparatie_electrica: 'Reparație electrică',
  dauna: 'Daună',
  service_roti: 'Service roți',
  diagnoza: 'Diagnoză',
  tinichigerie: 'Tinichigerie / vopsitorie',
  altele: 'Altele',
};
