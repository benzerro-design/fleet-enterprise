## Domain model canonical (vehicul, trip/job, event, maintenance, cost)

### Obiectiv
Stabilim un set de entitati canonice care vor fi folosite atat in API (NestJS), cat si in frontend (Next.js) si in Integration Hub:

- vehicul si asset (inclusiv remorca/semiremorca, agregate);
- trip/job (curse, interventii, lucrari);
- event (telemetrie, statusuri, workflow events);
- maintenance (planuri preventive + work orders);
- cost (costuri operationale si financiare, legate de CRM tickets).

### 1. Vehicul si asset

- `TenantScoped` (toate entitatile):
  - `tenantId: string`
  - `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

- `Vehicle`:
  - `id: string`
  - `clientId: string`
  - `type: 'car' | 'van_lt_3_5' | 'van_gt_3_5' | 'tractor_unit' | 'trailer' | 'semi_trailer'`
  - `vin: string`
  - `registrationNumber: string`
  - `status: 'active' | 'inactive' | 'in_maintenance' | 'decommissioned'`
  - `odometerKm: number`
  - `fuelType: 'diesel' | 'petrol' | 'cng' | 'lng' | 'electric' | 'hybrid'`
  - legaturi:
    - `currentDriverId?: string`
    - `composedWithTrailerId?: string` (pentru ansamblu)

- `Trailer` / `SemiTrailer` reuseaza acelasi model, diferentiat prin `type`.

- `Aggregate`:
  - `id: string`
  - `vehicleId: string`
  - `group: 'cooling' | 'hydraulics' | 'lift' | 'crane' | 'pto' | 'generator' | 'other'`
  - `status: 'active' | 'maintenance' | 'inactive'`

### 2. Trip/Job

- `Job`:
  - `id: string`
  - `tenantId`, `clientId`
  - `jobType: 'transport' | 'service_call' | 'maintenance' | 'roadside' | 'document_flow' | 'other'`
  - `ticketId: string` (legat de CRM modul M, obligatoriu)
  - `vehicleId: string`
  - `trailerId?: string`
  - `driverId?: string`
  - timp:
    - `plannedStartAt`, `plannedEndAt`
    - `actualStartAt?`, `actualEndAt?`
  - geografie:
    - `originLocationId?`, `destinationLocationId?`
  - `status: 'planned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'`

- `JobLeg` (optional, pentru rute complexe):
  - `jobId: string`
  - `sequence: number`
  - `fromLocationId`, `toLocationId`

### 3. Event (telemetrie + workflow)

- `Event`:
  - `id: string`
  - `tenantId`
  - `source: 'telematics' | 'user_action' | 'integration' | 'system'`
  - `entityType: 'vehicle' | 'job' | 'ticket' | 'document' | 'asset'`
  - `entityId: string`
  - `eventType: string` (ex: `gps_position`, `door_open`, `door_close`, `engine_on`, `engine_off`, `pv_signed`, `fuel_fill`, `itp_done`)
  - `occurredAt: Date`
  - `payload: JsonObject` (schema-specific per tip eveniment)

Pentru telemetrie GPS, payload-ul minim:

- `lat: number`
- `lng: number`
- `speedKph?: number`
- `headingDeg?: number`
- `odometerKm?: number`

### 4. Maintenance

- `MaintenancePlan`:
  - `id: string`
  - `tenantId`, `clientId`
  - `vehicleTypeScope: string[]` (tipuri vehicul eligibile)
  - `maintenanceType: 'preventive' | 'inspection' | 'legal'`
  - `triggerStrategy: 'time' | 'odometer' | 'engine_hours' | 'event_based' | 'mixed'`
  - `intervalDays?: number`
  - `intervalKm?: number`
  - `intervalEngineHours?: number`

- `MaintenanceWorkOrder`:
  - `id: string`
  - `tenantId`, `clientId`
  - `ticketId: string` (legat de CRM)
  - `vehicleId: string`
  - `supplierId?: string`
  - `status: 'draft' | 'approved' | 'waiting_parts' | 'in_progress' | 'done' | 'cancelled'`
  - `plannedAt`, `completedAt?`

### 5. Cost (operational + financiar)

- `CostRecord`:
  - `id: string`
  - `tenantId`, `clientId`
  - `ticketId?: string`
  - `jobId?: string`
  - `vehicleId?: string`
  - `supplierId?: string`
  - `category: 'maintenance' | 'damage' | 'fuel' | 'toll' | 'vignette' | 'insurance' | 'tax' | 'other'`
  - `amountNet: number`
  - `amountVat: number`
  - `currency: string`
  - `occurredAt: Date`
  - `externalInvoiceId?: string`
  - `costCenter?: string`

Aceste entitati vor fi reflectate in cod in modulul `api/src/domain` si expuse catre frontend prin DTO-uri si contracte API standardizate.

