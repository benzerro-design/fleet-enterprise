import type { MaintenancePlanTriggerMode } from '@prisma/client';

export type CreateMaintenancePlanItemDto = {
  title: string;
  category?: string | null;
  notes?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  intervalDays?: number | null;
  intervalKm?: number | null;
  triggerMode?: MaintenancePlanTriggerMode;
  lastServiceOn?: string | null;
  lastServiceKm?: number | null;
  nextDueOn?: string | null;
  dueOdometerKm?: number | null;
  dueManualOverride?: boolean;
  reminderOffsetsDays?: number[] | null;
  reminderOffsetsKm?: number[] | null;
  syncReminderAction?: boolean;
  preferredProvider?: string | null;
  estimatedCostCents?: number | null;
};

export type PatchMaintenancePlanItemDto = Partial<CreateMaintenancePlanItemDto>;

export type MarkMaintenancePlanPerformedDto = {
  performedOn?: string | null;
  performedKm?: number | null;
  notes?: string | null;
};
