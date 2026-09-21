import { ServiceAppointmentStatus } from '@prisma/client';
import {
  blocksSilentScheduledAtEdit,
} from './appointment-status.utils';

describe('blocksSilentScheduledAtEdit', () => {
  const t0 = new Date('2026-09-23T11:00:00.000Z');
  const t1 = new Date('2026-09-24T08:00:00.000Z');

  it('allows first slot assignment', () => {
    expect(
      blocksSilentScheduledAtEdit({
        status: ServiceAppointmentStatus.pending_supplier,
        existingScheduledAt: null,
        nextScheduledAt: t1,
      }),
    ).toBe(false);
  });

  it('allows same-time no-op', () => {
    expect(
      blocksSilentScheduledAtEdit({
        status: ServiceAppointmentStatus.scheduled,
        existingScheduledAt: t0,
        nextScheduledAt: new Date(t0.getTime()),
      }),
    ).toBe(false);
  });

  it('blocks time change on scheduled (manager counter-propose hole)', () => {
    expect(
      blocksSilentScheduledAtEdit({
        status: ServiceAppointmentStatus.scheduled,
        existingScheduledAt: t0,
        nextScheduledAt: t1,
      }),
    ).toBe(true);
  });

  it('blocks on pending_supplier / confirmed / needs_repropose', () => {
    for (const status of [
      ServiceAppointmentStatus.pending_supplier,
      ServiceAppointmentStatus.confirmed,
      ServiceAppointmentStatus.needs_repropose,
    ]) {
      expect(
        blocksSilentScheduledAtEdit({
          status,
          existingScheduledAt: t0,
          nextScheduledAt: t1,
        }),
      ).toBe(true);
    }
  });

  it('allows on cancelled / completed', () => {
    for (const status of [
      ServiceAppointmentStatus.cancelled,
      ServiceAppointmentStatus.completed,
    ]) {
      expect(
        blocksSilentScheduledAtEdit({
          status,
          existingScheduledAt: t0,
          nextScheduledAt: t1,
        }),
      ).toBe(false);
    }
  });
});
