import { TireCustodyProtocolKind } from '@prisma/client';
import type { TireHotelReleaseKind } from './tire-hotel.service';

/**
 * Protocol kinds that close the hotel stay on finalize via checkOutTx.
 * - check_out / leasing_return → at_client
 * - scrap → scrap
 * transfer & quarantine have dedicated finalize paths (not checkOut).
 * check_in / seasonal stay documentary.
 */
export function releaseKindForCustodyProtocol(
  kind: TireCustodyProtocolKind | string,
): TireHotelReleaseKind | null {
  if (kind === TireCustodyProtocolKind.scrap || kind === 'scrap') return 'scrap';
  if (kind === TireCustodyProtocolKind.check_out || kind === 'check_out') {
    return 'at_client';
  }
  if (kind === TireCustodyProtocolKind.leasing_return || kind === 'leasing_return') {
    return 'at_client';
  }
  return null;
}

export function isStockReleasingCustodyKind(kind: TireCustodyProtocolKind | string): boolean {
  return releaseKindForCustodyProtocol(kind) != null;
}

/** Exit / release documents (any of these signed satisfies „are PV de ieșire”). */
export const STOCK_RELEASE_CUSTODY_KINDS: TireCustodyProtocolKind[] = [
  TireCustodyProtocolKind.check_out,
  TireCustodyProtocolKind.scrap,
  TireCustodyProtocolKind.transfer,
  TireCustodyProtocolKind.leasing_return,
  TireCustodyProtocolKind.quarantine,
];

export function isTransferFinalizeKind(kind: TireCustodyProtocolKind | string): boolean {
  return kind === TireCustodyProtocolKind.transfer || kind === 'transfer';
}

export function isQuarantineFinalizeKind(kind: TireCustodyProtocolKind | string): boolean {
  return kind === TireCustodyProtocolKind.quarantine || kind === 'quarantine';
}
