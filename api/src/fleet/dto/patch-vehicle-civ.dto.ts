export type PatchVehicleCivDto = {
  civSeries?: string | null;
  civIssuedOn?: string | null;
  civRarOffice?: string | null;
  civMentions?: string | null;
  civProfile?: Record<string, string | number | null> | null;
  civImportedFromDocumentId?: string | null;
};

export type RecordOdometerDto = {
  odometerKm: number;
  notes?: string | null;
  source?: 'manual' | 'tracking' | 'import';
  sourceRef?: string | null;
};
