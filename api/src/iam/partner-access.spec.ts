import { ClientRole, MembershipRole, SupplierRole } from '@prisma/client';
import type { AccessContext } from './access-context.types';
import {
  assertPartnerOrTenantCustodyAccess,
  isPartnerUser,
  resolvePartnerSupplierIdsFilter,
} from './partner-access';

function access(partial: Partial<AccessContext>): AccessContext {
  return {
    userId: 'u1',
    tenantId: 't1',
    tenantSlug: 'demo',
    email: 'u@demo.local',
    displayName: 'User',
    membershipRole: MembershipRole.supplier_user,
    tenantFunctionalProfile: null,
    tenantFunctionalProfileMatrix: null,
    isTenantWide: false,
    clientMemberships: [],
    allowedClientIds: [],
    supplierMemberships: [
      {
        supplierId: 'sup-1',
        supplierCode: 'ALPHA',
        supplierLegalName: 'Alpha SRL',
        role: SupplierRole.supplier_manager,
      },
    ],
    allowedSupplierIds: ['sup-1'],
    ...partial,
  };
}

describe('assertPartnerOrTenantCustodyAccess', () => {
  it('allows supplier_user with membership', () => {
    expect(() => assertPartnerOrTenantCustodyAccess(access({}))).not.toThrow();
    expect(isPartnerUser(access({}))).toBe(true);
  });

  it('allows tenant-wide admin', () => {
    expect(() =>
      assertPartnerOrTenantCustodyAccess(
        access({
          membershipRole: MembershipRole.tenant_admin,
          isTenantWide: true,
          supplierMemberships: [],
          allowedSupplierIds: [],
        }),
      ),
    ).not.toThrow();
  });

  it('denies client_user even with supplier allocation elsewhere', () => {
    expect(() =>
      assertPartnerOrTenantCustodyAccess(
        access({
          membershipRole: MembershipRole.client_user,
          clientMemberships: [
            {
              clientId: 'c1',
              clientCode: 'C',
              role: ClientRole.client_admin,
              driverId: null,
              functionalProfile: null,
              iamSettings: {
                allowClientOcr: false,
                allowClientAcquisition: false,
                requireDriverAck: false,
                driverCanNegotiateAppointment: false,
                appointmentProposeFleetFirst: false,
                ticketListBulkSelect: false,
                appointmentProposalHistoryTabs: false,
                allowClientAdminCreateUsers: false,
              },
            },
          ],
          allowedClientIds: ['c1'],
        }),
      ),
    ).toThrow(/Stocul în custodie/);
  });
});

describe('resolvePartnerSupplierIdsFilter — single membership', () => {
  it('resolves supplier without explicit supplierId', () => {
    const ids = resolvePartnerSupplierIdsFilter(access({}), undefined);
    expect(ids).toEqual(['sup-1']);
  });
});
