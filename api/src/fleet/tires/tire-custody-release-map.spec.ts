import { TireCustodyProtocolKind } from '@prisma/client';
import {
  isStockReleasingCustodyKind,
  releaseKindForCustodyProtocol,
} from './tire-custody-release-map';

describe('releaseKindForCustodyProtocol', () => {
  it('maps scrap → scrap', () => {
    expect(releaseKindForCustodyProtocol(TireCustodyProtocolKind.scrap)).toBe('scrap');
  });
  it('maps transfer → in_transit', () => {
    expect(releaseKindForCustodyProtocol('transfer')).toBe('in_transit');
  });
  it('maps leasing_return → at_client', () => {
    expect(releaseKindForCustodyProtocol('leasing_return')).toBe('at_client');
  });
  it('maps quarantine → quarantine', () => {
    expect(releaseKindForCustodyProtocol(TireCustodyProtocolKind.quarantine)).toBe(
      'quarantine',
    );
    expect(releaseKindForCustodyProtocol('quarantine')).toBe('quarantine');
  });
  it('returns null for documentary kinds', () => {
    expect(releaseKindForCustodyProtocol('check_in')).toBeNull();
    expect(releaseKindForCustodyProtocol('check_out')).toBeNull();
    expect(releaseKindForCustodyProtocol('seasonal')).toBeNull();
  });
  it('isStockReleasingCustodyKind', () => {
    expect(isStockReleasingCustodyKind('scrap')).toBe(true);
    expect(isStockReleasingCustodyKind('quarantine')).toBe(true);
    expect(isStockReleasingCustodyKind('check_out')).toBe(false);
  });
});
