export type TireLedgerMovementSource = 'placement' | 'stay' | 'event';

export type TireLedgerMovement = {
  id: string;
  at: string;
  source: TireLedgerMovementSource;
  kind: string;
  label: string;
  plate?: string | null;
  vehicleId?: string | null;
  assetId?: string | null;
  setId?: string | null;
  stayId?: string | null;
  workOrderId?: string | null;
  supplierName?: string | null;
  locationCode?: string | null;
  sourceSystem?: string | null;
};

export type TireLedgerPayload = {
  entityType: 'asset' | 'vehicle' | 'client';
  entityId: string;
  movements: TireLedgerMovement[];
};
