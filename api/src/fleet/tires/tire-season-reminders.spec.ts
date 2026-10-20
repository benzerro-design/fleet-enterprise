import { syncSeasonTireRemindersForTenant } from './tire-season-reminders';
import type { PrismaService } from '../../prisma/prisma.service';

describe('syncSeasonTireRemindersForTenant', () => {
  it('returns zeros when vehicleIds is an empty array (no prisma calls)', async () => {
    const findMany = jest.fn();
    const prisma = { vehicle: { findMany }, tireSet: { findMany }, reminderAction: { findMany } } as unknown as PrismaService;

    const result = await syncSeasonTireRemindersForTenant(prisma, 'tenant-1', []);

    expect(result).toEqual({ created: 0, updated: 0, deactivated: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });
});
