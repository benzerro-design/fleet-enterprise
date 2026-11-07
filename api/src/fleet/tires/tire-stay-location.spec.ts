import { formatStayLocation, parseStayLocation, resolveStayLocationInput } from './tire-stay-location';

describe('tire-stay-location', () => {
  it('parses bay/bin', () => {
    expect(parseStayLocation('a/12')).toEqual({
      bayCode: 'A',
      binCode: '12',
      locationCode: 'A/12',
    });
    expect(parseStayLocation('BAY-A')).toEqual({
      bayCode: 'BAY-A',
      binCode: null,
      locationCode: 'BAY-A',
    });
  });

  it('formats and resolves inputs', () => {
    expect(formatStayLocation('a', '3')).toBe('A/3');
    expect(resolveStayLocationInput({ bayCode: 'b', binCode: '2' }).locationCode).toBe('B/2');
    expect(resolveStayLocationInput({ locationCode: 'c/9' }).bayCode).toBe('C');
  });
});
