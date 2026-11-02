import {
  hashBrokerSecretForStorage,
  sealSecret,
  secretsEqual,
  sha256Hex,
  unsealSecret,
} from './rsa-broker-crypto';
import { mapInboundEventToInterventionStatus } from './rsa-broker-payload';
import { buildBrokerDispatchPayload } from './rsa-broker-payload';
import { RoadsideInterventionStatus } from '@prisma/client';

describe('rsa-broker-crypto', () => {
  it('hashes and compares secrets timing-safe', () => {
    const hash = sha256Hex('secret-one');
    expect(secretsEqual('secret-one', hash)).toBe(true);
    expect(secretsEqual('wrong', hash)).toBe(false);
  });

  it('seal/unseal roundtrip', () => {
    const sealed = sealSecret('broker-key-xyz');
    expect(unsealSecret(sealed)).toBe('broker-key-xyz');
    expect(unsealSecret('bad')).toBeNull();
  });

  it('hashBrokerSecretForStorage returns last4 + sealed', () => {
    const s = hashBrokerSecretForStorage('abcd1234');
    expect(s.last4).toBe('1234');
    expect(s.hash).toHaveLength(64);
    expect(unsealSecret(s.sealed)).toBe('abcd1234');
  });
});

describe('rsa-broker-payload', () => {
  it('builds dispatch payload schema v1', () => {
    const p = buildBrokerDispatchPayload({
      tenantSlug: 'demo',
      intervention: {
        id: 'i1',
        displayNumber: 'RSA-2026-0001',
        kind: 'tow',
        status: 'requested',
        locationText: 'DN1 km 10',
        entitlementStatus: 'pay_per_use',
        requestedAt: new Date('2026-01-01T10:00:00Z'),
        notes: null,
        clientId: 'c1',
        clientLegalName: 'Client SA',
        vehicleId: 'v1',
        vehicleReg: 'B-01-XYZ',
      },
      supplier: { id: 's1', legalName: 'RSA SRL' },
      mission: null,
      sla: {
        ackMinutes: 10,
        arrivalUrbanMinutes: 45,
        arrivalHighwayMinutes: 60,
        is24x7: true,
      },
      issuedAt: new Date('2026-01-01T10:05:00Z'),
    });
    expect(p.schemaVersion).toBe(1);
    expect(p.eventType).toBe('dispatch_request');
    expect(p.intervention.displayNumber).toBe('RSA-2026-0001');
    expect(p.sla.is24x7).toBe(true);
  });

  it('maps inbound events to intervention status', () => {
    expect(mapInboundEventToInterventionStatus('ack')).toBe(
      RoadsideInterventionStatus.dispatched,
    );
    expect(mapInboundEventToInterventionStatus('on_scene')).toBe(
      RoadsideInterventionStatus.on_site,
    );
    expect(mapInboundEventToInterventionStatus('completed')).toBe(
      RoadsideInterventionStatus.completed,
    );
    expect(mapInboundEventToInterventionStatus('cancelled')).toBe(
      RoadsideInterventionStatus.cancelled,
    );
    expect(mapInboundEventToInterventionStatus('unknown')).toBeNull();
  });
});
