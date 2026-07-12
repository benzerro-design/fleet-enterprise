import { SupplierServiceKind } from '@prisma/client';
import {
  SUPPLIER_SERVICE_KINDS,
  supplierServiceDescription,
  supplierServiceLabel,
} from '../suppliers/supplier-services';

export type TenantServiceTypeRow = {
  id: string;
  code: string;
  label: string;
  clientDescription: string;
  sortOrder: number;
  active: boolean;
  system: boolean;
  usedBySuppliers: number;
  usedByTickets: number;
  createdAt: string;
  updatedAt: string;
};

const CODE_RE = /^[a-z][a-z0-9_]{1,63}$/;

export function parseServiceTypeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('code required');
  const code = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (!CODE_RE.test(code)) {
    throw new Error('code must be a lowercase slug (a-z, 0-9, _)');
  }
  return code;
}

export function isEnumServiceKind(code: string): code is SupplierServiceKind {
  return (SUPPLIER_SERVICE_KINDS as string[]).includes(code);
}

export function defaultTenantServiceTypeSeeds() {
  return SUPPLIER_SERVICE_KINDS.map((kind, sortOrder) => ({
    code: kind,
    label: supplierServiceLabel(kind),
    clientDescription: supplierServiceDescription(kind),
    sortOrder,
    active: true,
    system: true,
  }));
}

export function mapTenantServiceTypeRow(
  row: {
    id: string;
    code: string;
    label: string;
    clientDescription: string;
    sortOrder: number;
    active: boolean;
    system: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  usage: { suppliers: number; tickets: number },
): TenantServiceTypeRow {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    clientDescription: row.clientDescription,
    sortOrder: row.sortOrder,
    active: row.active,
    system: row.system,
    usedBySuppliers: usage.suppliers,
    usedByTickets: usage.tickets,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
