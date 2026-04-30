## Platform foundation (multi-tenancy, RBAC, audit, observability, security)

### 1. Multi-tenancy model

- **Tenant-per-row (shared schema)** in baza de date (Cloud SQL Postgres):
  - toate entitatile canonice contin `tenantId`;
  - index compus `(tenant_id, id)` pentru lookup rapid;
  - constrangeri la nivel de aplicatie (NestJS guards) pentru a impune `tenantId` pe toate query-urile.
- **Tenant context**:
  - extras din `sub`/`tenant` claim in JWT sau din `X-Tenant-Id` pentru Superadmin;
  - injectat printr-un `TenantContext` service in Nest, disponibil in module.

### 2. RBAC (role-based access control)

- Roluri de baza (din plan):
  - `SUPERADMIN`, `ADMIN`, `FLEET_MANAGER_CLIENT`, `SOFER_CLIENT`,
  - `CONSILIER_SERVICE`, `GESTIONAR`, `FURNIZOR`, `FINANCIAR`.
- Model:
  - `User` (global id) + `UserTenant` (roluri per tenant) + `Permission` (coduri operationale);
  - matrici de permisiuni per rol si modul, asa cum este in sectiunea Settings din plan.
- In NestJS:
  - `AuthModule` (JWT + session);
  - `RbacModule` cu:
    - decorator `@Roles(...)` si guard care verifica rolul + scope (tenant, client, entitate);
    - service pentru interogare permisiuni din DB (cache-uite).

### 3. Audit

- Entitate generica `AuditEvent`:
  - `tenantId`, `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `payloadBefore`, `payloadAfter`, `occurredAt`, `ip`, `userAgent`.
- Implementare in Nest:
  - `AuditModule` cu interceptor global care logheaza:
    - operatiuni sensibile (create/edit/delete, modificare permisiuni, integrari, setari);
  - integrat cu logger-ul aplicatiei si stocat in Postgres + posibil export in BigQuery/Data Warehouse ulterior.

### 4. Observability

- **Logging**:
  - Nest logger custom, structurat (JSON), directionat catre Cloud Logging;
  - corelat cu `requestId`/`correlationId`.
- **Metrics**:
  - export Prometheus-style metrics (sau direct Cloud Monitoring);
  - SLO:
    - latency p95/p99 pentru endpointuri critice (`/tickets`, `/tracking`, `/integrations`).
- **Tracing**:
  - OpenTelemetry integrat cu Nest si Next (tranzactii end-to-end);
  - export catre Cloud Trace.

### 5. Security baseline

- **Auth**:
  - JWT access tokens, refresh tokens, optional OIDC/SAML pentru clienti enterprise;
  - MFA configurabil pentru roluri sensibile (Superadmin, Admin, Financiar).
- **Transport & storage**:
  - HTTPS only, HSTS, TLS modern;
  - encrypt-at-rest via Cloud SQL / Cloud Storage (default GCP).
- **Data protection**:
  - PII marcat in schema (soferi, clienti);
  - mask partial in loguri si rapoarte pentru roluri neautorizate.
- **Hardening**:
  - rate limiting si IP throttling pe endpointuri sensibile;
  - CSRF protection pentru UI authenticated flows;
  - secret management prin GCP Secret Manager.

### 6. Module NestJS (API)

Primele module API:

- `AuthModule` — login, token refresh, profile;
- `TenantModule` — management tenant + context;
- `UsersModule` — useri, roluri, permission matrix;
- `AuditModule` — scriere audit events;
- `VehiclesModule` — entitatile canonice pentru vehicule (folosind modelele din `domain/models.ts`);
- `HealthModule` — endpointuri de health pentru Cloud Run.

Aceste module vor fi extinse ulterior cu integrarea CRM si a modului de Settings conform rubricilor din plan.

