import type { TripPurpose, TripRoadType } from '@prisma/client';

export function tripPurposeLabel(p: TripPurpose | null | undefined): string {
  switch (p) {
    case 'business':
      return 'Serviciu';
    case 'personal':
      return 'Personal';
    case 'mixed':
      return 'Mixt';
    default:
      return '—';
  }
}

export function tripRoadTypeLabel(r: TripRoadType | null | undefined): string {
  switch (r) {
    case 'urban':
      return 'Urban';
    case 'extra_urban':
      return 'Extraurban';
    case 'highway':
      return 'Autostrada';
    case 'mixed':
      return 'Mixt';
    default:
      return '—';
  }
}

export function tripSheetDocTypeLabel(t: 'trip_sheet' | 'faz_monthly'): string {
  return t === 'faz_monthly' ? 'FAZ lunar' : 'Foaie de parcurs';
}
