export type TenantScoped = {
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export type VehicleType =
  | 'car'
  | 'van_lt_3_5'
  | 'van_gt_3_5'
  | 'tractor_unit'
  | 'trailer'
  | 'semi_trailer';

export type FuelType =
  | 'diesel'
  | 'petrol'
  | 'cng'
  | 'lng'
  | 'electric'
  | 'hybrid';

export type VehicleStatus =
  | 'active'
  | 'inactive'
  | 'in_maintenance'
  | 'decommissioned';

export type Vehicle = TenantScoped & {
  id: string;
  clientId: string;
  type: VehicleType;
  vin: string;
  registrationNumber: string;
  status: VehicleStatus;
  odometerKm: number;
  fuelType: FuelType;
  currentDriverId?: string;
  composedWithTrailerId?: string;
};

export type AggregateGroup =
  | 'cooling'
  | 'hydraulics'
  | 'lift'
  | 'crane'
  | 'pto'
  | 'generator'
  | 'other';

export type AggregateStatus = 'active' | 'maintenance' | 'inactive';

export type Aggregate = TenantScoped & {
  id: string;
  vehicleId: string;
  group: AggregateGroup;
  status: AggregateStatus;
};

export type JobType =
  | 'transport'
  | 'service_call'
  | 'maintenance'
  | 'roadside'
  | 'document_flow'
  | 'other';

export type JobStatus =
  | 'planned'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type Job = TenantScoped & {
  id: string;
  clientId: string;
  jobType: JobType;
  ticketId: string;
  vehicleId: string;
  trailerId?: string;
  driverId?: string;
  plannedStartAt: Date;
  plannedEndAt: Date;
  actualStartAt?: Date;
  actualEndAt?: Date;
  originLocationId?: string;
  destinationLocationId?: string;
  status: JobStatus;
};

export type JobLeg = TenantScoped & {
  id: string;
  jobId: string;
  sequence: number;
  fromLocationId: string;
  toLocationId: string;
};

export type EventSource =
  | 'telematics'
  | 'user_action'
  | 'integration'
  | 'system';

export type EventEntityType =
  | 'vehicle'
  | 'job'
  | 'ticket'
  | 'document'
  | 'asset';

export type Event = TenantScoped & {
  id: string;
  source: EventSource;
  entityType: EventEntityType;
  entityId: string;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export type MaintenanceTriggerStrategy =
  | 'time'
  | 'odometer'
  | 'engine_hours'
  | 'event_based'
  | 'mixed';

export type MaintenancePlan = TenantScoped & {
  id: string;
  clientId: string;
  vehicleTypeScope: VehicleType[];
  maintenanceType: 'preventive' | 'inspection' | 'legal';
  triggerStrategy: MaintenanceTriggerStrategy;
  intervalDays?: number;
  intervalKm?: number;
  intervalEngineHours?: number;
};

export type MaintenanceWorkOrderStatus =
  | 'draft'
  | 'approved'
  | 'waiting_parts'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type MaintenanceWorkOrder = TenantScoped & {
  id: string;
  clientId: string;
  ticketId: string;
  vehicleId: string;
  supplierId?: string;
  status: MaintenanceWorkOrderStatus;
  plannedAt: Date;
  completedAt?: Date;
};

export type CostCategory =
  | 'maintenance'
  | 'damage'
  | 'fuel'
  | 'toll'
  | 'vignette'
  | 'insurance'
  | 'tax'
  | 'other';

export type CostRecord = TenantScoped & {
  id: string;
  clientId: string;
  ticketId?: string;
  jobId?: string;
  vehicleId?: string;
  supplierId?: string;
  category: CostCategory;
  amountNet: number;
  amountVat: number;
  currency: string;
  occurredAt: Date;
  externalInvoiceId?: string;
  costCenter?: string;
};

