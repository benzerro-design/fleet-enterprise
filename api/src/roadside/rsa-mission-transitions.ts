import { RsaMissionStatus } from '@prisma/client';

const EDGES: Record<RsaMissionStatus, RsaMissionStatus[]> = {
  assigned: [RsaMissionStatus.en_route, RsaMissionStatus.cancelled],
  en_route: [RsaMissionStatus.on_scene, RsaMissionStatus.cancelled],
  on_scene: [RsaMissionStatus.picked_up, RsaMissionStatus.cancelled],
  picked_up: [RsaMissionStatus.in_transit, RsaMissionStatus.cancelled],
  in_transit: [RsaMissionStatus.delivered, RsaMissionStatus.cancelled],
  delivered: [RsaMissionStatus.closed],
  closed: [],
  cancelled: [],
};

export function canTransitionMission(
  from: RsaMissionStatus,
  to: RsaMissionStatus,
): boolean {
  if (from === to) return true;
  return (EDGES[from] ?? []).includes(to);
}

/** Statusuri care cer PV semnat înainte de tranziție. */
export function requiresSignedProtocol(
  to: RsaMissionStatus,
): 'pickup' | 'dropoff' | null {
  if (to === RsaMissionStatus.picked_up) return 'pickup';
  if (to === RsaMissionStatus.delivered) return 'dropoff';
  return null;
}

export function timestampFieldForStatus(
  status: RsaMissionStatus,
):
  | 'enRouteAt'
  | 'onSceneAt'
  | 'pickedUpAt'
  | 'inTransitAt'
  | 'deliveredAt'
  | 'closedAt'
  | 'cancelledAt'
  | null {
  switch (status) {
    case RsaMissionStatus.en_route:
      return 'enRouteAt';
    case RsaMissionStatus.on_scene:
      return 'onSceneAt';
    case RsaMissionStatus.picked_up:
      return 'pickedUpAt';
    case RsaMissionStatus.in_transit:
      return 'inTransitAt';
    case RsaMissionStatus.delivered:
      return 'deliveredAt';
    case RsaMissionStatus.closed:
      return 'closedAt';
    case RsaMissionStatus.cancelled:
      return 'cancelledAt';
    default:
      return null;
  }
}
