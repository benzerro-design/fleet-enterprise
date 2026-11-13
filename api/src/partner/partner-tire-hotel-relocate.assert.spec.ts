import { BadRequestException } from '@nestjs/common';
import { assertRelocateBody } from './partner-tire-hotel-relocate.assert';

describe('assertRelocateBody', () => {
  it('requires stayId', () => {
    expect(() => assertRelocateBody({ warehouseLocationId: 'loc-1' })).toThrow(BadRequestException);
  });

  it('requires location input', () => {
    expect(() => assertRelocateBody({ stayId: 's1' })).toThrow(/warehouseLocationId|bayCode/);
  });

  it('accepts warehouseLocationId', () => {
    const dto = assertRelocateBody({ stayId: 's1', warehouseLocationId: '  loc-1  ' });
    expect(dto.warehouseLocationId).toBe('loc-1');
    expect(dto.stayId).toBe('s1');
  });

  it('keeps bay fallback', () => {
    const dto = assertRelocateBody({ stayId: 's1', bayCode: 'A', binCode: '2' });
    expect(dto.bayCode).toBe('A');
    expect(dto.binCode).toBe('2');
  });
});
