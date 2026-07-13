import { SupplierServiceKind } from '@prisma/client';

/** @deprecated Enum legacy — catalogul activ vine din TenantServiceType. */
export const SUPPLIER_SERVICE_KINDS: SupplierServiceKind[] = [
  SupplierServiceKind.mechanics,
  SupplierServiceKind.electrical,
  SupplierServiceKind.bodywork_painting,
  SupplierServiceKind.damage_repair,
  SupplierServiceKind.itp,
  SupplierServiceKind.tire_service,
  SupplierServiceKind.periodic_maintenance,
  SupplierServiceKind.ac_climate,
  SupplierServiceKind.diagnostics,
  SupplierServiceKind.towing,
  SupplierServiceKind.glass_repair,
];

const LABELS: Record<SupplierServiceKind, string> = {
  [SupplierServiceKind.mechanics]: 'Mecanică',
  [SupplierServiceKind.electrical]: 'Electrică',
  [SupplierServiceKind.bodywork_painting]: 'Tinichigerie & vopsitorie',
  [SupplierServiceKind.damage_repair]: 'Daune / constatare',
  [SupplierServiceKind.itp]: 'ITP',
  [SupplierServiceKind.tire_service]: 'Vulcanizare / anvelope',
  [SupplierServiceKind.periodic_maintenance]: 'Revizie periodică',
  [SupplierServiceKind.ac_climate]: 'Climatizare',
  [SupplierServiceKind.diagnostics]: 'Diagnoză computerizată',
  [SupplierServiceKind.towing]: 'Tractări / asistență rutieră',
  [SupplierServiceKind.glass_repair]: 'Parbrize & geamuri',
};

const DESCRIPTIONS: Record<SupplierServiceKind, string> = {
  [SupplierServiceKind.mechanics]: 'Reparații mecanice, frâne, suspensie, motor',
  [SupplierServiceKind.electrical]: 'Instalații electrice, baterie, alternator',
  [SupplierServiceKind.bodywork_painting]: 'Tinichigerie, vopsitorie, elemente caroserie',
  [SupplierServiceKind.damage_repair]: 'Daune RCA/CASCO, constatare, dezmembrări',
  [SupplierServiceKind.itp]: 'Stație ITP autorizată',
  [SupplierServiceKind.tire_service]: 'Montaj anvelope, echilibrare, vulcanizare',
  [SupplierServiceKind.periodic_maintenance]: 'Revizii planificate, schimburi ulei/filtre',
  [SupplierServiceKind.ac_climate]: 'Încărcare freon, service climatizare',
  [SupplierServiceKind.diagnostics]: 'Tester OBD, identificare defecțiuni',
  [SupplierServiceKind.towing]: 'Tractări auto, platformă',
  [SupplierServiceKind.glass_repair]: 'Înlocuire parbriz, lunetă, geamuri laterale',
};

export type SupplierCatalogEntry = {
  id: string;
  code: string;
  label: string;
  description: string;
};

export function supplierServiceLabel(kind: string): string {
  return LABELS[kind as SupplierServiceKind] ?? kind;
}

export function supplierServiceDescription(kind: string): string {
  return DESCRIPTIONS[kind as SupplierServiceKind] ?? '';
}

/** Parse array of service type codes from API body. */
export function parseSupplierServiceCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const code = item.trim().toLowerCase();
    if (!code || out.includes(code)) continue;
    out.push(code);
  }
  return out;
}

/** @deprecated use parseSupplierServiceCodes */
export function parseSupplierServiceKinds(raw: unknown): SupplierServiceKind[] {
  return parseSupplierServiceCodes(raw).filter((c): c is SupplierServiceKind =>
    SUPPLIER_SERVICE_KINDS.includes(c as SupplierServiceKind),
  );
}

export function supplierServiceCatalog() {
  return SUPPLIER_SERVICE_KINDS.map((kind) => ({
    id: kind,
    code: kind,
    kind,
    label: supplierServiceLabel(kind),
    description: supplierServiceDescription(kind),
  }));
}
