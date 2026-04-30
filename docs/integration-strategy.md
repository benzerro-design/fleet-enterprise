## Integration Hub – strategie si prioritizare

### 1. Principii

- Hub unic de integrare (`IntegrationService` din plan):
  - conectori modulari per provider, fara logica de business direct in conector;
  - model canonical (vehicul, job, event, cost) folosit ca limbaj comun.
- Suport sync + async:
  - request/response pentru interogari simple;
  - webhooks/events + queue pentru fluxuri continue (tracking, facturi, documente).

### 2. Prioritati Phase 1–2

1. **Telematics/Tracking providers** (Phase 1 Must):
   - ingestie pozitie GPS, evenimente usa, temperatura/umiditate (unde exista senzori);
   - normalizare in entitatea `Event` + update `Vehicle`/`Job`.
2. **Vignette/eTransport/eToll** (Phase 2):
   - generare tranzactii vigneta/taxa drum;
   - status si reconciliere cost.
3. **Service/Anvelope/Agregate**:
   - import devize/facturi si statusuri lucrare de la furnizori;
   - mapping in `MaintenanceWorkOrder` + `CostRecord`.
4. **ERP/Accounting**:
   - export facturi/costuri catre sistem contabil;
   - mapping campuri financiare (rubrica Settings - N).

### 3. Arhitectura tehnica (API NestJS)

- `IntegrationsModule`:
  - submodule:
    - `TelematicsModule`
    - `TollModule`
    - `ServiceModule`
    - `AccountingModule`
  - serviciu comun `IntegrationBus` pentru:
    - enqueue/dequeue mesaje;
    - retry/backoff;
    - dead-letter queue.
- GCP:
  - Pub/Sub pentru cozi async;
  - Cloud Scheduler pentru polling unde lipsesc webhooks.

### 4. Contracte standard

- **Inbound** (spre platforma):
  - telematics: `vehicleId`, `timestamp`, `lat`, `lng`, `speed`, `doorStatus`, `temperature`, `odometerKm`;
  - service: `workOrderId`, `lines`, `status`, `documents`, `totalCost`;
  - fuel: `refuelId`, `amount`, `liters`, `odometerKm`, `station`.
- **Outbound** (spre sisteme externe):
  - ERP/accounting: `invoiceId`, `supplierId`, `net`, `vat`, `currency`, `costCenter`, `ticketId`.

### 5. Observabilitate integrari

- log per mesaj (success/error, retry count);
- dashboard per connector:
  - throughput, error rate, latency;
  - dead-letter queue size.

