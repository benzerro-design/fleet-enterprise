import { BadRequestException } from '@nestjs/common';

export function assertRelocateBody(body: unknown): {
  supplierId?: string;
  stayId: string;
  locationCode?: string;
  bayCode?: string;
  binCode?: string;
  warehouseLocationId?: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const stayId = typeof o.stayId === 'string' ? o.stayId.trim() : '';
  if (!stayId) throw new BadRequestException('stayId is required');
  const supplierId =
    o.supplierId === undefined || o.supplierId === null
      ? undefined
      : typeof o.supplierId === 'string'
        ? o.supplierId.trim()
        : undefined;
  const locationCode =
    o.locationCode === undefined || o.locationCode === null
      ? undefined
      : typeof o.locationCode === 'string'
        ? o.locationCode.trim()
        : undefined;
  const bayCode =
    o.bayCode === undefined || o.bayCode === null
      ? undefined
      : typeof o.bayCode === 'string'
        ? o.bayCode.trim()
        : undefined;
  const binCode =
    o.binCode === undefined || o.binCode === null
      ? undefined
      : typeof o.binCode === 'string'
        ? o.binCode.trim()
        : undefined;
  const warehouseLocationId =
    o.warehouseLocationId === undefined || o.warehouseLocationId === null
      ? undefined
      : typeof o.warehouseLocationId === 'string'
        ? o.warehouseLocationId.trim()
        : undefined;
  if (!locationCode && !bayCode && !warehouseLocationId) {
    throw new BadRequestException(
      'warehouseLocationId, locationCode or bayCode is required',
    );
  }
  return { supplierId, stayId, locationCode, bayCode, binCode, warehouseLocationId };
}
