import { RoadsideInterventionKind, RoadsideInterventionStatus } from '@prisma/client';

/** Payload standard outbound către broker 24×7. */
export type RsaBrokerDispatchPayload = {
  schemaVersion: 1;
  eventType: 'dispatch_request';
  tenantSlug: string;
  intervention: {
    id: string;
    displayNumber: string | null;
    kind: RoadsideInterventionKind | string;
    status: RoadsideInterventionStatus | string;
    locationText: string | null;
    entitlementStatus: string;
    requestedAt: string | null;
    notes: string | null;
  };
  client: { id: string; legalName: string };
  vehicle: {
    id: string | null;
    registrationNumber: string | null;
  };
  supplier: { id: string; legalName: string };
  mission: {
    id: string;
    status: string;
    pickupLocationText: string | null;
    dropoffLocationText: string | null;
    etaMinutes: number | null;
  } | null;
  sla: {
    ackMinutes: number;
    arrivalUrbanMinutes: number;
    arrivalHighwayMinutes: number;
    is24x7: boolean;
  };
  issuedAt: string;
};

export function buildBrokerDispatchPayload(input: {
  tenantSlug: string;
  intervention: {
    id: string;
    displayNumber: string | null;
    kind: string;
    status: string;
    locationText: string | null;
    entitlementStatus: string;
    requestedAt: Date | null;
    notes: string | null;
    clientId: string;
    clientLegalName: string;
    vehicleId: string | null;
    vehicleReg: string | null;
  };
  supplier: { id: string; legalName: string };
  mission: {
    id: string;
    status: string;
    pickupLocationText: string | null;
    dropoffLocationText: string | null;
    etaMinutes: number | null;
  } | null;
  sla: {
    ackMinutes: number;
    arrivalUrbanMinutes: number;
    arrivalHighwayMinutes: number;
    is24x7: boolean;
  };
  issuedAt?: Date;
}): RsaBrokerDispatchPayload {
  const issuedAt = (input.issuedAt ?? new Date()).toISOString();
  return {
    schemaVersion: 1,
    eventType: 'dispatch_request',
    tenantSlug: input.tenantSlug,
    intervention: {
      id: input.intervention.id,
      displayNumber: input.intervention.displayNumber,
      kind: input.intervention.kind,
      status: input.intervention.status,
      locationText: input.intervention.locationText,
      entitlementStatus: input.intervention.entitlementStatus,
      requestedAt: input.intervention.requestedAt?.toISOString() ?? null,
      notes: input.intervention.notes,
    },
    client: {
      id: input.intervention.clientId,
      legalName: input.intervention.clientLegalName,
    },
    vehicle: {
      id: input.intervention.vehicleId,
      registrationNumber: input.intervention.vehicleReg,
    },
    supplier: input.supplier,
    mission: input.mission,
    sla: input.sla,
    issuedAt,
  };
}

/** Mapează eventType inbound → status intervenție (dacă e cazul). */
export function mapInboundEventToInterventionStatus(
  eventType: string,
): RoadsideInterventionStatus | null {
  const t = eventType.trim().toLowerCase();
  switch (t) {
    case 'ack':
    case 'accepted':
    case 'dispatched':
      return RoadsideInterventionStatus.dispatched;
    case 'en_route':
    case 'on_scene':
    case 'on_site':
      return RoadsideInterventionStatus.on_site;
    case 'completed':
    case 'delivered':
    case 'closed':
      return RoadsideInterventionStatus.completed;
    case 'cancelled':
    case 'canceled':
      return RoadsideInterventionStatus.cancelled;
    default:
      return null;
  }
}
