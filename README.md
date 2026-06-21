# Fleet enterprise

Monorepo minim: **web** (Next.js) + **api** (NestJS), aliniat cu rularea pe **Google Cloud**.

> **Document fundațional — identitate și acces (IAM):** [`docs/identity-access-model.md`](docs/identity-access-model.md)  
> Model SaaS multi-tenant, ierarhie tenant → client contractual → useri, roluri și ce există vs. țintă. **Prioritate canonică** pentru orice decizie legată de useri și drepturi.

## Cerințe

- Node.js LTS (instalat pe mașina de dezvoltare)
- **PostgreSQL** care ascultă pe **localhost:5432** (vezi variantele de mai jos)

## Pornire locală

### Verificare rapidă (Windows)

Din rădăcina monorepo-ului (`fleet-enterprise/`), în PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup-local.ps1
```

Scriptul îți spune dacă lipsesc **Docker**, **portul 5432** sau **`api/.env`** și copiază automat `api/.env.example` → `api/.env` dacă `.env` nu există.

---

### Varianta A — Postgres cu Docker (recomandat)

1. Instalează [Docker Desktop pentru Windows](https://docs.docker.com/desktop/install/windows-install/), pornește aplicația și lasă motorul „running” (iconița balenă din tray).
2. Din rădăcina `fleet-enterprise/`:

```powershell
docker compose up -d
```

3. `DATABASE_URL` din `api/.env.example` se potrivește cu `docker-compose.yml` (user/parolă/db: `fleet` / `fleet` / `fleet`).

Dacă `docker` nu e recunoscut în PowerShell, Docker Desktop nu e instalat sau nu e în PATH — folosește **varianta B**.

---

### Varianta B — Postgres instalat pe Windows (fără Docker)

1. Instalează PostgreSQL (ex. de pe [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)) și notează parola setată pentru utilizatorul **`postgres`**.
2. Deschide **pgAdmin** sau **SQL Shell (psql)** și rulează (o singură dată), conectat ca superuser `postgres`:

```sql
CREATE USER fleet WITH PASSWORD 'fleet';
CREATE DATABASE fleet OWNER fleet;
GRANT ALL PRIVILEGES ON DATABASE fleet TO fleet;
```

3. În `api/.env`, păstrează linia din `.env.example` (aceeași utilizator/parolă/bază ca mai sus):

```env
DATABASE_URL="postgresql://fleet:fleet@localhost:5432/fleet?schema=public"
```

Dacă ai ales altă parolă sau alt port, modifică `DATABASE_URL` în consecință.

---

### După ce Postgres rulează (A sau B)

În `api/`:

```powershell
cd api
npm install
npm run db:migrate
npm run db:seed
```

Erori frecvente:

| Mesaj / simptom | Cauză probabilă |
|-----------------|-----------------|
| `Can't reach database server` / `P1001` | Postgres nu rulează sau portul nu e 5432. |
| `password authentication failed` | Parola din `DATABASE_URL` nu coincide cu cea din Postgres. |
| `database "fleet" does not exist` | Nu ai creat baza `fleet` (vezi SQL la varianta B). |
| `npm run db:migrate` fără `api/.env` | Copiază: `Copy-Item .env.example .env` în folderul `api`. |

### Aplicații (UI + API)

Terminal 1 — API (implicit port **4000**):

```powershell
cd api
npm install
npm run start:dev
```

Terminal 2 — web (implicit port **3000**):

```bash
cd web
npm install
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000). Pagina citește health de la API (vezi `API_URL` / `NEXT_PUBLIC_API_URL` în `web/.env.local`).

### Autentificare (utilizatori în Postgres)

1. După ce ai rulat **`npm run db:migrate`**, rulează **`npm run db:seed`** (din `api/`): creează tenanții `default` / `demo`, **`admin@demo.local`** (rol **`tenant_admin`**) și **`viewer@demo.local`** (rol **`tenant_viewer`**), ambele cu parola **`demo12345`** pe tenant **`demo`**, plus **12 curse demo**, **4 vehicule** și **costuri combustibil** pentru testarea FAZ. Dacă ai actualizat proiectul și contul viewer nu exista, **rulează din nou seed** ca să fie creat/actualizat. Doar curse: **`npm run db:seed:trips`** (opțional `TENANT_SLUG=demo`).
2. În **`api/.env`**: `JWT_SECRET` (vezi `api/.env.example`).
3. În **`web/.env.local`**: `API_URL=http://localhost:4000` (vezi `web/.env.example`).
4. Pornește API + web → [http://localhost:3000/login](http://localhost:3000/login): **email**, **parolă**, **tenant slug** (`demo`). Dacă utilizatorul are un singur tenant, poți lăsa slug gol.
5. După login: cookie **httpOnly** cu JWT; `/fleet/*` → proxy **`/api/fleet/*`** cu `Authorization: Bearer …` (același cookie pentru **`/api/trips/*`**, **`/api/maintenance/*`**, **`/api/costs/*`**, **`/api/documents/*`** către Nest). Tenantul activ vine din JWT, nu din variabile publice în browser.

**Utilizatori noi:** `npm run auth:hash-password -- "parola"` apoi inserează rând în `User` + `TenantMembership` (sau Prisma Studio). Migrația adaugă tabelele `User` și `TenantMembership`.

**curl la Nest:** `POST /auth/login` cu `{ "email", "password", "tenantSlug"? }` → token, apoi `Authorization: Bearer` pe `/fleet/*`, `/trips`, `/maintenance`, `/costs`. Pentru teste automate poți folosi `ALLOW_HEADER_TENANT=true` (vezi `test/jest-e2e-setup.ts`).

### RBAC (roluri pe tenant)

**Model complet (canonic):** [`docs/identity-access-model.md`](docs/identity-access-model.md) — ierarhie platformă → tenant → client → useri; FlotaX = abonat SaaS (tenant), nu client în `demo`.

Rolul vine din **`TenantMembership.role`** (Prisma: `tenant_admin`, `tenant_viewer`) și este inclus în JWT la login pentru tenantul ales. Dacă îți schimbă rolul un administrator, trebuie **re-login** ca să primești un token nou.

- **`tenant_admin`**: citire + creare / modificare / ștergere vehicule și documente (`POST` / `PATCH` / `DELETE` pe `/fleet/vehicles*`), plus scriere pe **`/trips`**, **`/maintenance`**, **`/costs`**, **`/documents`** (curse, mentenanță, costuri, documente per vehicul).
- **`tenant_viewer`**: doar **`GET`** pe `/fleet/vehicles*`, **`/trips`**, **`/maintenance`**, **`/costs`**, **`/documents`**; orice operație de scriere returnează **403** (`Insufficient role for this operation`).

**UI (Next):** pe rutele `/fleet/*`, serverul React apelează **`GET /auth/me`** (cu `Authorization: Bearer` din cookie **httpOnly** prin `API_URL`) ca să știe **rolul** și să ascundă butoanele de scriere pentru `tenant_viewer`. Dacă API-ul nu răspunde, se afișează un mesaj de eroare, nu se tratează contul ca „viewer” pe baza absenței răspunsului.

### Fleet core (Postgres + Prisma)

UI (după login):

- [http://localhost:3000/fleet/vehicles](http://localhost:3000/fleet/vehicles)

API (protecție JWT + RBAC; în teste e2e se folosește `X-Tenant-Id` fără JWT — vezi `test/jest-e2e-setup.ts`):

- `POST /auth/login` — `{ "email", "password", "tenantSlug"? }` → `{ accessToken }` (JWT cu tenant + rol pentru slug-ul dat)
- `GET /auth/me` — același Bearer → `{ email?, tenantSlug, role }` (profil JWT + rol; folosit de UI pentru RBAC vizual)
- `GET /fleet/vehicles?page&pageSize&q&status` … → `{ items, total, page, pageSize }` (**viewer** și **admin**)
- `GET /fleet/vehicles/export?q&status` … → fișier **CSV** (filtre aceleași ca lista)
- `GET /fleet/vehicles/:vehicleId`
- `POST /fleet/vehicles`
- `PATCH /fleet/vehicles/:vehicleId`
- `DELETE /fleet/vehicles/:vehicleId`
- `POST /fleet/vehicles/:vehicleId/documents`

**Tenant / audit (JWT + RBAC)**

- `GET /tenant/members` — (`tenant_admin`) membrii tenantului curent din JWT.
- `PATCH /tenant/members/:userId` — (`tenant_admin`) `{ "role": "tenant_admin" | "tenant_viewer" }`; nu permite să îți modifici propriul rol (MVP).
- `GET /tenant/audit-log?page&pageSize&entityType?&action?` — (`tenant_admin`, `tenant_viewer`) înregistrări de audit pentru tenant; `action` filtrează exact câmpul `action` (ex. `update`, `create`).

### Faza următoare (implementat în repo — detalii)

După migrația **`20260418213000_phase2_audit_modules`** (+ `npm run db:migrate` și `npm run db:generate` dacă EPERM pe Windows închizi procesele care blochează DLL-ul Prisma):

| Zonă | Ce există acum |
|------|----------------|
| **Flotă UI** | Listă cu căutare, status, paginare, export CSV; pagină **`/fleet/vehicles/[id]`** (detaliu); edit rămâne la **`/fleet/vehicles/[id]/edit`**. |
| **Audit** | Tabel **`AuditLog`** + actor pe **`Vehicle`** (`createdByUserId`, `updatedByUserId`). Operațiile pe vehicule și schimbarea rolului membrilor generează înregistrări. **`/fleet/audit`** în UI. |
| **Membri** | **`/fleet/members`** pentru `tenant_admin`: listă și schimbare rol (fără flux de invitație email încă). |
| **Trip / mentenanță / costuri** | REST **`/trips`**, **`/maintenance`**, **`/costs`** (paginare + filtru `vehicleId`), mapate pe modelele Prisma; **BFF** Next: **`/api/trips/*`**, **`/api/maintenance/*`**, **`/api/costs/*`**. |
| **Documente** | REST **`/documents`** (listă tenant, filtre expirare, CRUD, export CSV); tipuri: RCA, CASCO, certificat înmatriculare, CIV, ITP etc.; UI **`/fleet/documents`**; **BFF** **`/api/documents/*`**. |

### Variabile opționale

- **api**: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `WEB_ORIGIN` (vezi `api/.env.example`)
- **web**: `API_URL` (recomandat, server-only, spre Nest) în `web/.env.local`
- **web**: `NEXT_PUBLIC_API_URL` (opțional, pentru health / link-uri absolute în client)

### Comenzi utile (API)

- `npm run db:generate` — regenerează clientul Prisma
- `npm run db:migrate` — aplică migrațiile (`prisma migrate deploy`)
- `npm run db:migrate:dev` — creează migrații noi în dev (`prisma migrate dev`)
- `npm run db:seed` — seed (tenanți + utilizatori demo + curse demo pe tenant `demo`)
- `npm run db:seed:trips` — doar vehicule/curse/combustibil demo (`TENANT_SLUG` opțional; implicit `demo` + `default` dacă există)
- `npm run db:studio` — Prisma Studio

### Teste e2e

Din **`api/`**, cu **Postgres pornit** și **`api/.env`** cu `DATABASE_URL` valid:

- **`npm run test:e2e`** — flota cu tenant din header (**`ALLOW_HEADER_TENANT=true`** în `test/jest-e2e-setup.ts`), **fără JWT** și **fără verificare RBAC**.
- **`npm run test:e2e:rbac`** — login real + JWT: verifică **GET /fleet/vehicles** pentru admin și viewer, **POST/DELETE** **403** pentru viewer și **201/204** pentru admin; necesită **`npm run db:migrate`** și **`npm run db:seed`** (utilizatori `admin@demo.local` / `viewer@demo.local` pe tenant **`demo`**). Nu folosește bypass-ul din header.

**Notă:** rularea paralelă a celor două suite în aceeași comandă nu e suportată (variabile de mediu diferite); lansează-le separat.

## Structură

- `web/` — UI operator (evoluție spre module flotă + CRM)
- `api/` — REST API, multi-tenant și integrări (următorii pași)

## Cloud Run deploy automat (CI/CD)

Repo-ul include `cloudbuild.yaml` pentru fluxul: build imagine API -> push în Artifact Registry -> deploy în Cloud Run.

### 1) Precondiții (o singură dată)

- Artifact Registry repo (ex: `fleet-enterprise`) în `europe-west1`
- Cloud Run service: `fleet-api`
- Secret Manager:
  - `DATABASE_URL` (valoare: URI Neon complet)
  - `JWT_SECRET` (valoare: secret JWT)
- Permisiuni pentru Cloud Build service account:
  - Cloud Run Admin
  - Artifact Registry Writer
  - Secret Manager Secret Accessor
  - Service Account User

### 2) Trigger pe branch `main`

În Cloud Build -> Triggers -> Create trigger:

- Event: push to branch
- Branch: `^main$`
- Config: `cloudbuild.yaml`
- Substitutions recomandate:
  - `_SERVICE=fleet-api`
  - `_RUN_REGION=europe-west1`
  - `_AR_REGION=europe-west1`
  - `_AR_REPO=fleet-enterprise`
  - `_WEB_ORIGIN=<url-ul frontend>`

După asta, orice `git push` pe `main` face deploy automat.

### Frontend (`web/`) — GitHub Actions

Workflow: `.github/workflows/deploy-web.yml` (deploy la `fleet-web-stg` pe Cloud Run).

În GitHub **Settings → Secrets → Actions**, adaugă:

- `API_URL` — URL-ul public al API-ului Nest (ex. `https://fleet-api-xxxxx.europe-west1.run.app`, fără slash final)

La `git push` pe `main` cu modificări în `web/**`, se face build + deploy automat (la fel ca API-ul).

## Backup / restore Neon (manual, rapid)

Scripturi incluse:

- `ops/backup-neon.cmd`
- `ops/restore-neon.cmd`

Exemple:

```bat
ops\backup-neon.cmd "postgresql://USER:PASS@HOST.neon.tech/neondb?sslmode=require"
ops\restore-neon.cmd "postgresql://USER:PASS@HOST.neon.tech/neondb?sslmode=require" "backup-neon-YYYYMMDD-HHMMSS.sql"
```

Necesită utilitarele `pg_dump` și `psql` în PATH.
