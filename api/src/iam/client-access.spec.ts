import { ClientRole, FunctionalProfile, MembershipRole } from '@prisma/client';
import type { AccessContext } from './access-context.types';
import {
  canOperateServiceCase,
  canPerformTicketAction,
  canReadTicket,
  canWriteClientFleet,
  isDriverOnlyClientUser,
  ticketListScope,
} from './client-access';

function baseCtx(partial: Partial<AccessContext> & Pick<AccessContext, 'clientMemberships'>): AccessContext {
  return {
    userId: 'user-driver',
    tenantId: 't1',
    tenantSlug: 'demo',
    email: 'sofer@demo.local',
    displayName: 'Șofer',
    membershipRole: MembershipRole.client_user,
    tenantFunctionalProfile: null,
    isTenantWide: false,
    allowedClientIds: partial.clientMemberships.map((m) => m.clientId),
    supplierMemberships: [],
    allowedSupplierIds: [],
    assignedVehicleIds: [],
    ...partial,
  };
}

const driverMembership = {
  clientId: 'client-a',
  clientCode: 'ALPHA',
  role: ClientRole.driver,
  driverId: 'driver-1',
  functionalProfile: null,
  iamSettings: {
    allowClientOcr: false,
    allowClientAcquisition: false,
    requireDriverAck: true,
    driverCanNegotiateAppointment: false,
    appointmentProposeFleetFirst: false,
    ticketListBulkSelect: false,
    appointmentProposalHistoryTabs: false,
    allowClientAdminCreateUsers: false,
  },
};

const managerMembership = {
  ...driverMembership,
  role: ClientRole.client_admin,
  driverId: null,
};

describe('ticketListScope — L0', () => {
  it('include tichete pe vehicule alocate (nu doar createdBy/driverId)', () => {
    const ctx = baseCtx({
      clientMemberships: [driverMembership],
      assignedVehicleIds: ['veh-1', 'veh-2'],
    });
    const scope = ticketListScope(ctx);
    expect(scope).toEqual({
      OR: [
        {
          clientId: 'client-a',
          OR: [
            { createdByUserId: 'user-driver' },
            { driverId: 'driver-1' },
            { vehicleId: { in: ['veh-1', 'veh-2'] } },
          ],
        },
      ],
    });
  });

  it('fără vehicule alocate — doar createdBy + driverId', () => {
    const ctx = baseCtx({
      clientMemberships: [driverMembership],
      assignedVehicleIds: [],
    });
    const scope = ticketListScope(ctx);
    expect(scope).toEqual({
      OR: [
        {
          clientId: 'client-a',
          OR: [{ createdByUserId: 'user-driver' }, { driverId: 'driver-1' }],
        },
      ],
    });
  });
});

describe('canReadTicket — L0', () => {
  const ctx = baseCtx({
    clientMemberships: [driverMembership],
    assignedVehicleIds: ['veh-1'],
  });

  it('vede tichet pe vehicul alocat chiar fără driverId / createdBy', () => {
    expect(
      canReadTicket(ctx, {
        clientId: 'client-a',
        createdByUserId: 'other-user',
        driverId: null,
        vehicleId: 'veh-1',
      }),
    ).toBe(true);
  });

  it('nu vede tichet pe alt vehicul', () => {
    expect(
      canReadTicket(ctx, {
        clientId: 'client-a',
        createdByUserId: 'other-user',
        driverId: null,
        vehicleId: 'veh-other',
      }),
    ).toBe(false);
  });
});

describe('canPerformTicketAction — L0 vs L1', () => {
  const ticketOnVehicle = {
    clientId: 'client-a',
    createdByUserId: 'other-user',
    driverId: null as string | null,
    vehicleId: 'veh-1',
  };

  const driverCtx = baseCtx({
    clientMemberships: [driverMembership],
    assignedVehicleIds: ['veh-1'],
  });

  const managerCtx = baseCtx({
    userId: 'user-mgr',
    email: 'manager@demo.local',
    displayName: 'Manager',
    clientMemberships: [managerMembership],
  });

  it('șoferul poate transform pe tichet vizibil (cursă)', () => {
    expect(canPerformTicketAction(driverCtx, 'transform', ticketOnVehicle)).toBe(true);
  });

  it('șoferul nu poate claim / resolve / route / patch', () => {
    expect(canPerformTicketAction(driverCtx, 'claim', ticketOnVehicle)).toBe(false);
    expect(canPerformTicketAction(driverCtx, 'resolve', ticketOnVehicle)).toBe(false);
    expect(canPerformTicketAction(driverCtx, 'route', ticketOnVehicle)).toBe(false);
    expect(canPerformTicketAction(driverCtx, 'patch', ticketOnVehicle)).toBe(false);
  });

  it('șoferul poate comment pe tichet vizibil', () => {
    expect(canPerformTicketAction(driverCtx, 'comment', ticketOnVehicle)).toBe(true);
  });

  it('managerul poate claim / resolve / route / patch / transform', () => {
    expect(canPerformTicketAction(managerCtx, 'claim', ticketOnVehicle)).toBe(true);
    expect(canPerformTicketAction(managerCtx, 'resolve', ticketOnVehicle)).toBe(true);
    expect(canPerformTicketAction(managerCtx, 'route', ticketOnVehicle)).toBe(true);
    expect(canPerformTicketAction(managerCtx, 'patch', ticketOnVehicle)).toBe(true);
    expect(canPerformTicketAction(managerCtx, 'transform', ticketOnVehicle)).toBe(true);
  });

  it('șoferul nu transformă tichet în afara scope-ului (alt vehicul)', () => {
    expect(
      canPerformTicketAction(driverCtx, 'transform', {
        ...ticketOnVehicle,
        vehicleId: 'veh-other',
      }),
    ).toBe(false);
  });

  it('șoferul transformă tichetul creat de el chiar fără vehicul alocat', () => {
    const bare = baseCtx({
      clientMemberships: [driverMembership],
      assignedVehicleIds: [],
    });
    const own = {
      clientId: 'client-a',
      createdByUserId: 'user-driver',
      driverId: null,
      vehicleId: 'veh-unassigned',
    };
    expect(canReadTicket(bare, own)).toBe(true);
    expect(canPerformTicketAction(bare, 'transform', own)).toBe(true);
  });

  it('isDriverOnlyClientUser e true doar pentru membership-uri driver', () => {
    expect(isDriverOnlyClientUser(driverCtx)).toBe(true);
    expect(isDriverOnlyClientUser(managerCtx)).toBe(false);
  });
});

describe('ticketListScope — L1', () => {
  it('managerul vede tot clientul, nu filtrul de vehicule al șoferului', () => {
    const ctx = baseCtx({
      userId: 'user-mgr',
      email: 'manager@demo.local',
      clientMemberships: [managerMembership],
      assignedVehicleIds: ['veh-1'],
    });
    expect(ticketListScope(ctx)).toEqual({
      OR: [{ clientId: 'client-a' }],
    });
  });
});

describe('canWriteClientFleet / canOperateServiceCase — L1 vs L0', () => {
  const driverCtx = baseCtx({
    clientMemberships: [{ ...driverMembership, functionalProfile: FunctionalProfile.full }],
    assignedVehicleIds: ['veh-1'],
  });

  const managerCtx = baseCtx({
    userId: 'user-mgr',
    email: 'manager@demo.local',
    displayName: 'Manager',
    clientMemberships: [managerMembership],
  });

  it('managerul L1 scrie flotă și operează dosarul pe clientul lui', () => {
    expect(canWriteClientFleet(managerCtx)).toBe(true);
    expect(canOperateServiceCase(managerCtx, 'client-a')).toBe(true);
  });

  it('șoferul L0 nu scrie flotă și nu operează dosar, chiar cu profil full', () => {
    expect(canWriteClientFleet(driverCtx)).toBe(false);
    expect(canOperateServiceCase(driverCtx, 'client-a')).toBe(false);
  });

  it('managerul nu operează dosar pe alt client', () => {
    expect(canOperateServiceCase(managerCtx, 'client-b')).toBe(false);
  });
});
