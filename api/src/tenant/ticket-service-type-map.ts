import { CrmTicketType } from '@prisma/client';

/** Map enum tichet → cod catalog tenant (backfill + fallback). */
export const TICKET_TYPE_TO_SERVICE_CODE: Record<CrmTicketType, string> = {
  itp: 'itp',
  damage: 'damage_repair',
  maintenance: 'mechanics',
  document: 'diagnostics',
  transport: 'towing',
  technical: 'diagnostics',
  other: 'mechanics',
};

/** Map cod catalog → enum tichet (workflow / filtre legacy). */
export function serviceTypeCodeToTicketType(code: string): CrmTicketType {
  if (code === 'itp') return CrmTicketType.itp;
  if (code === 'damage_repair') return CrmTicketType.damage;
  if (
    [
      'mechanics',
      'periodic_maintenance',
      'electrical',
      'diagnostics',
      'ac_climate',
      'tire_service',
      'bodywork_painting',
      'glass_repair',
    ].includes(code)
  ) {
    return CrmTicketType.maintenance;
  }
  if (code === 'towing') return CrmTicketType.technical;
  return CrmTicketType.other;
}

export function ticketTypeToDefaultServiceCode(ticketType: CrmTicketType): string {
  return TICKET_TYPE_TO_SERVICE_CODE[ticketType];
}
