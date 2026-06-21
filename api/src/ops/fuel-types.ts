import { BadRequestException } from '@nestjs/common';
import type { FuelType } from '@prisma/client';

export const FUEL_TYPE_VALUES: FuelType[] = ['diesel', 'petrol', 'hybrid', 'electric', 'lpg'];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  diesel: 'Motorină',
  petrol: 'Benzină',
  hybrid: 'Hybrid',
  electric: 'Electric',
  lpg: 'GPL',
};

export function fuelTypeLabel(value: FuelType | null | undefined): string {
  if (!value) return '—';
  return FUEL_TYPE_LABELS[value] ?? value;
}

export function parseFuelType(value: unknown): FuelType | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  if ((FUEL_TYPE_VALUES as string[]).includes(normalized)) {
    return normalized as FuelType;
  }
  return null;
}

export function assertFuelType(value: unknown, field: string): FuelType {
  const parsed = parseFuelType(value);
  if (!parsed) throw new BadRequestException(`Invalid ${field}`);
  return parsed;
}

export function normalizeFuelProductType(
  value: FuelType | null | undefined,
  category: string,
  isFuelCategory: (c: string) => boolean,
): FuelType | null {
  if (!isFuelCategory(category)) return null;
  if (value === undefined || value === null) {
    throw new BadRequestException('fuelProductType is required for Combustibil costs');
  }
  return value;
}
