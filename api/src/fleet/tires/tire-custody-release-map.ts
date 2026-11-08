import { TireCustodyProtocolKind } from '@prisma/client';
import type { TireHotelReleaseKind } from './tire-hotel.service';

/**
 * Protocol kinds that release hotel stock on finalize.
 * check_in / check_out / seasonal stay documentary (check_out still uses hotel API separately).
 */
export function releaseKindForCustodyProtocol(
  kind: TireCustodyProtocolKind | string,
): TireHotelReleaseKind | null {
  if (kind === TireCustodyProtocolKind.scrap || kind === 'scrap') return 'scrap';
  if (kind === TireCustodyProtocolKind.transfer || kind === 'transfer') return 'in_transit';
  if (kind === TireCustodyProtocolKind.leasing_return || kind === 'leasing_return') {
    return 'at_client';
  }
  if (kind === TireCustodyProtocolKind.quarantine || kind === 'quarantine') {
    return 'quarantine';
  }
  return null;
}

export function isStockReleasingCustodyKind(kind: TireCustodyProtocolKind | string): boolean {
  return releaseKindForCustodyProtocol(kind) != null;
}

export const STOCK_RELEASE_CUSTODY_KINDS: TireCustodyProtocolKind[] = [
  TireCustodyProtocolKind.check_out,
  TireCustodyProtocolKind.scrap,
  TireCustodyProtocolKind.transfer,
  TireCustodyProtocolKind.leasing_return,
  TireCustodyProtocolKind.quarantine,
];
