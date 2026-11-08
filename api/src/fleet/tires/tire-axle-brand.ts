import { BadRequestException } from '@nestjs/common';
import type { VehicleWheelPosition } from '@prisma/client';

export type AxleBrandItem = {
  position: VehicleWheelPosition | string;
  brand?: string | null;
};

function normBrand(brand: string | null | undefined): string | null {
  const b = brand?.trim();
  return b ? b.toUpperCase() : null;
}

function assertAxlePair(
  left: VehicleWheelPosition,
  right: VehicleWheelPosition,
  byPos: Map<string, string | null>,
): void {
  const l = byPos.get(left);
  const r = byPos.get(right);
  if (l == null || r == null) return;
  if (l !== r) {
    throw new BadRequestException(
      `Mixed tyre brands on same axle (${left}/${right}: ${l} vs ${r})`,
    );
  }
}

/** Front axle (fl/fr) and rear (rl/rr) must each use one brand; front and rear may differ. */
export function validateAxleBrandPairs(items: AxleBrandItem[]): void {
  const byPos = new Map<string, string | null>();
  for (const item of items) {
    const pos = String(item.position).trim().toLowerCase();
    if (!['fl', 'fr', 'rl', 'rr'].includes(pos)) continue;
    const brand = normBrand(item.brand);
    if (brand) byPos.set(pos, brand);
  }
  assertAxlePair('fl', 'fr', byPos);
  assertAxlePair('rl', 'rr', byPos);
}
