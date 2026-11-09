import { TireGestiuneOp } from '@prisma/client';
import {
  defaultGestiuneSubject,
  displayTicketShortId,
  mapTireRequestKind,
  parseTireGestiuneOp,
  tireRequestKindLabel,
} from './tire-gestiune-request';

describe('tire-gestiune-request', () => {
  it('parses gestiune ops', () => {
    expect(parseTireGestiuneOp('cazare')).toBe(TireGestiuneOp.cazare);
    expect(parseTireGestiuneOp('ELIBERARE')).toBe(TireGestiuneOp.eliberare);
    expect(parseTireGestiuneOp('nope')).toBeNull();
  });

  it('maps kinds with gestiuneOp preferred over service code', () => {
    expect(
      mapTireRequestKind({ gestiuneOp: TireGestiuneOp.transfer, serviceCode: 'tire_storage' }),
    ).toBe('transfer');
    expect(mapTireRequestKind({ serviceCode: 'tire_storage' })).toBe('storage');
    expect(mapTireRequestKind({ serviceCode: 'tire_service' })).toBe('service');
  });

  it('labels and subjects', () => {
    expect(tireRequestKindLabel('casare')).toBe('Casare');
    expect(defaultGestiuneSubject(TireGestiuneOp.cazare, 'b108vdf')).toBe(
      'Cazare anvelope — B108VDF',
    );
    expect(displayTicketShortId('abcdefghijklmnop')).toBe('KLMNOP');
  });
});
