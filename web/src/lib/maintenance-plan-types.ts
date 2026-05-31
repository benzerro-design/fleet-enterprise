import type { ReminderActionSummary } from "@/lib/reminder-actions";

export type MaintenancePlanTriggerMode = "time" | "km" | "whichever_first";

export type MaintenancePlanItemRecord = {
  id: string;
  vehicleId: string;
  title: string;
  category: string | null;
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
  intervalDays: number | null;
  intervalKm: number | null;
  triggerMode: MaintenancePlanTriggerMode;
  lastServiceOn: string | null;
  lastServiceKm: number | null;
  nextDueOn: string | null;
  dueOdometerKm: number | null;
  dueManualOverride: boolean;
  reminderOffsetsDays: number[] | null;
  reminderOffsetsKm: number[] | null;
  reminderMenuSyncEnabled: boolean;
  preferredProvider: string | null;
  estimatedCostCents: number | null;
  createdAt: string;
  updatedAt: string;
  summary: ReminderActionSummary;
  intervalLabel: string;
};

export type MaintenancePlanPayload = {
  items: MaintenancePlanItemRecord[];
  vehicleOdometerKm: number;
  stats: {
    total: number;
    active: number;
    dueSoon: number;
    overdue: number;
    syncedReminders: number;
  };
};
