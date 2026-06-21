import type { FuelType } from '@prisma/client';
import { parseFuelType } from '../ops/fuel-types';
import type { VehicleCivProfile } from './vehicle-civ-fields';

function normalizeText(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Map free-text CIV P.3 (Combustibil / sursă energie) to FuelType. */
export function parseCivFuelTypeText(raw: unknown): FuelType | null {
  const t = normalizeText(raw);
  if (!t) return null;

  const direct = parseFuelType(t);
  if (direct) return direct;

  if (/(^|\b)(diesel|motorina|motorin|gasoil|mazut)(\b|$)/.test(t)) return 'diesel';
  if (/(^|\b)(benzina|benzin|petrol|gasoline|essence|super)(\b|$)/.test(t)) return 'petrol';
  if (/(^|\b)(gpl|lpg|gaz petrolier)(\b|$)/.test(t)) return 'lpg';
  if (/(^|\b)(electric|electrica|kwh|kw\/h|battery|baterie)(\b|$)/.test(t)) return 'electric';
  if (/(^|\b)(hybrid|hibrid)(\b|$)/.test(t)) return 'hybrid';

  return null;
}

/** Cost Combustibil: auto from CIV P.3 only; null if P.3 missing/unrecognized. */
export function resolveVehicleFuelFromCivP3(civProfile: VehicleCivProfile | null | undefined): FuelType | null {
  return parseCivFuelTypeText(civProfile?.fuelType);
}

/** Consum / filtre flotă: CIV P.3, apoi câmpul fuelType de pe vehicul. */
export function resolveVehicleFuelType(input: {
  fuelType?: FuelType | null;
  civProfile?: VehicleCivProfile | null;
}): FuelType | null {
  const fromCiv = parseCivFuelTypeText(input.civProfile?.fuelType);
  if (fromCiv) return fromCiv;
  if (input.fuelType) return input.fuelType;
  return null;
}

export function fuelEnergyUnit(fuelType: FuelType): 'L' | 'kWh' {
  return fuelType === 'electric' ? 'kWh' : 'L';
}
