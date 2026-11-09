import { TireGestiuneOp } from '@prisma/client';

/** Coduri catalog care apar în coada Anvelope (legacy + gestiune pe tire_storage). */
export const TIRE_REQUEST_SERVICE_CODES = ['tire_storage', 'tire_service'] as const;

export const TIRE_GESTIUNE_OPS = [
  TireGestiuneOp.cazare,
  TireGestiuneOp.eliberare,
  TireGestiuneOp.transfer,
  TireGestiuneOp.casare,
] as const;

export type TireRequestKind =
  | 'cazare'
  | 'eliberare'
  | 'transfer'
  | 'casare'
  | 'storage'
  | 'service'
  | 'other';

export function parseTireGestiuneOp(raw: unknown): TireGestiuneOp | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if ((TIRE_GESTIUNE_OPS as readonly string[]).includes(v)) {
    return v as TireGestiuneOp;
  }
  return null;
}

export function tireGestiuneOpLabel(op: TireGestiuneOp | string | null | undefined): string {
  switch (op) {
    case TireGestiuneOp.cazare:
    case 'cazare':
      return 'Cazare';
    case TireGestiuneOp.eliberare:
    case 'eliberare':
      return 'Eliberare';
    case TireGestiuneOp.transfer:
    case 'transfer':
      return 'Transfer';
    case TireGestiuneOp.casare:
    case 'casare':
      return 'Casare';
    default:
      return 'Gestiune';
  }
}

export function mapTireRequestKind(opts: {
  gestiuneOp?: TireGestiuneOp | string | null;
  serviceCode?: string | null;
}): TireRequestKind {
  if (opts.gestiuneOp) {
    const op = String(opts.gestiuneOp);
    if (op === 'cazare' || op === 'eliberare' || op === 'transfer' || op === 'casare') {
      return op;
    }
  }
  if (opts.serviceCode === 'tire_storage') return 'storage';
  if (opts.serviceCode === 'tire_service') return 'service';
  return 'other';
}

export function tireRequestKindLabel(kind: TireRequestKind, serviceLabel?: string | null): string {
  switch (kind) {
    case 'cazare':
      return 'Cazare';
    case 'eliberare':
      return 'Eliberare';
    case 'transfer':
      return 'Transfer';
    case 'casare':
      return 'Casare';
    case 'storage':
      return 'Depozitare';
    case 'service':
      return 'Înlocuire';
    default:
      return serviceLabel?.trim() || 'Anvelope';
  }
}

export function defaultGestiuneSubject(op: TireGestiuneOp, plate: string | null | undefined): string {
  const label = tireGestiuneOpLabel(op);
  const p = plate?.trim().toUpperCase();
  return p ? `${label} anvelope — ${p}` : `${label} anvelope`;
}

export function displayTicketShortId(id: string): string {
  return id.slice(-6).toUpperCase();
}
