import {
  formatTireSetSearchFieldOnChange,
  parseTireSetSearchInput,
  TIRE_SET_QR_PREFIX,
  tireSetQrPayload,
} from './tire-domain.types';

describe('parseTireSetSearchInput', () => {
  it('empty → plate empty', () => {
    expect(parseTireSetSearchInput('   ')).toEqual({ kind: 'plate', plate: '' });
  });

  it('FE:tire-set prefix → setId with preserved id casing', () => {
    const setId = 'cLk9AbCdEfGhIjKlMnOpQrSt';
    expect(parseTireSetSearchInput(`${TIRE_SET_QR_PREFIX}${setId}`)).toEqual({
      kind: 'setId',
      setId,
    });
    expect(parseTireSetSearchInput(`fe:TIRE-SET:${setId}`)).toEqual({
      kind: 'setId',
      setId,
    });
  });

  it('raw cuid → setId with case preserved', () => {
    const mixed = 'cLk9AbCdEfGhIjKlMnOpQrStUv';
    expect(parseTireSetSearchInput(mixed)).toEqual({ kind: 'setId', setId: mixed });
  });

  it('plate normalizes spaces and uppercases', () => {
    expect(parseTireSetSearchInput('b 123 abc')).toEqual({ kind: 'plate', plate: 'B123ABC' });
  });
});

describe('formatTireSetSearchFieldOnChange', () => {
  it('preserves cuid casing while typing', () => {
    const partial = 'cLk9AbCdEfGhIjKlMnOpQrSt';
    expect(formatTireSetSearchFieldOnChange(partial)).toBe(partial);
  });

  it('preserves QR payload id casing', () => {
    const id = 'cLk9AbCdEfGhIjKlMnOpQrSt';
    const raw = `${TIRE_SET_QR_PREFIX}${id}`;
    expect(formatTireSetSearchFieldOnChange(raw)).toBe(raw);
  });

  it('uppercases plate input', () => {
    expect(formatTireSetSearchFieldOnChange('b123abc')).toBe('B123ABC');
  });
});

describe('tireSetQrPayload', () => {
  it('builds stable FE prefix payload', () => {
    expect(tireSetQrPayload('abc')).toBe('FE:tire-set:abc');
  });
});
