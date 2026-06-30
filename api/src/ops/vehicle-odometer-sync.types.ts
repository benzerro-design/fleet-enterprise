export type VehicleOdometerSyncPayload = {
  updated: boolean;
  previousKm: number;
  newKm: number;
  message: string;
  severity: 'ok' | 'info' | 'warning' | 'critical';
  messages: string[];
  timelineConsistent: boolean;
  readingCreated: boolean;
};

export type OpsOdometerEntity = 'cost' | 'maintenance' | 'trip';

export type OdometerTimelineViolation = {
  severity: 'critical';
  message: string;
  earlierRecordedAt: string;
  earlierKm: number;
  laterRecordedAt: string;
  laterKm: number;
};

export type OdometerTimelineAnalysis = {
  currentKmFromTimeline: number | null;
  latestRecordedAt: string | null;
  violations: OdometerTimelineViolation[];
  hasCriticalViolations: boolean;
  isConsistent: boolean;
};

export type OdometerPreviewPayload = {
  severity: 'ok' | 'info' | 'warning' | 'critical';
  messages: string[];
  message: string;
  willUpdateCurrentKm: boolean;
  newCurrentKm: number;
  vehicleOdometerKm: number;
  timelineConsistent: boolean;
  requiresConfirmation: boolean;
};
