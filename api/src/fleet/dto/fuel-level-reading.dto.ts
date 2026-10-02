export type FuelLevelReadingSource = 'manual' | 'import' | 'telematics';

export type RecordFuelLevelDto = {
  liters?: number | null;
  percent?: number | null;
  recordedAt?: string | null;
  notes?: string | null;
  source?: FuelLevelReadingSource;
  sourceRef?: string | null;
};

export type FuelLevelReadingRecord = {
  id: string;
  vehicleId: string;
  liters: number | null;
  percent: number | null;
  source: FuelLevelReadingSource;
  sourceRef: string | null;
  notes: string | null;
  recordedAt: string;
  recordedByEmail: string | null;
};

export type FuelLevelReadingsPayload = {
  items: FuelLevelReadingRecord[];
};
