import { TireCustodyProtocolKind } from '@prisma/client';
import {
  isQuarantineFinalizeKind,
  isStockReleasingCustodyKind,
  isTransferFinalizeKind,
  releaseKindForCustodyProtocol,
} from './tire-custody-release-map';

describe('releaseKindForCustodyProtocol', () => {
  it('maps scrap → scrap', () => {
    expect(releaseKindForCustodyProtocol(TireCustodyProtocolKind.scrap)).toBe('scrap');
  });
  it('maps check_out → at_client', () => {
    expect(releaseKindForCustodyProtocol('check_out')).toBe('at_client');
  });
  it('maps leasing_return → at_client', () => {
    expect(releaseKindForCustodyProtocol('leasing_return')).toBe('at_client');
  });
  it('returns null for transfer / quarantine / documentary', () => {
    expect(releaseKindForCustodyProtocol('transfer')).toBeNull();
    expect(releaseKindForCustodyProtocol('quarantine')).toBeNull();
    expect(releaseKindForCustodyProtocol('check_in')).toBeNull();
    expect(releaseKindForCustodyProtocol('seasonal')).toBeNull();
  });
  it('isStockReleasingCustodyKind', () => {
    expect(isStockReleasingCustodyKind('scrap')).toBe(true);
    expect(isStockReleasingCustodyKind('check_out')).toBe(true);
    expect(isStockReleasingCustodyKind('quarantine')).toBe(false);
    expect(isStockReleasingCustodyKind('transfer')).toBe(false);
  });
  it('transfer / quarantine finalize helpers', () => {
    expect(isTransferFinalizeKind('transfer')).toBe(true);
    expect(isQuarantineFinalizeKind(TireCustodyProtocolKind.quarantine)).toBe(true);
  });
});
