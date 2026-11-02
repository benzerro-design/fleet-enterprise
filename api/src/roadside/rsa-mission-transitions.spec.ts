import { RsaMissionStatus } from '@prisma/client';
import {
  canTransitionMission,
  requiresSignedProtocol,
} from './rsa-mission-transitions';

describe('rsa-mission-transitions', () => {
  it('allows assigned → en_route and blocks skip to delivered', () => {
    expect(canTransitionMission(RsaMissionStatus.assigned, RsaMissionStatus.en_route)).toBe(
      true,
    );
    expect(canTransitionMission(RsaMissionStatus.assigned, RsaMissionStatus.delivered)).toBe(
      false,
    );
  });

  it('requires pickup protocol for picked_up and dropoff for delivered', () => {
    expect(requiresSignedProtocol(RsaMissionStatus.picked_up)).toBe('pickup');
    expect(requiresSignedProtocol(RsaMissionStatus.delivered)).toBe('dropoff');
    expect(requiresSignedProtocol(RsaMissionStatus.en_route)).toBeNull();
  });
});
