# Fleet Enterprise API (NestJS)

**IAM (canonic):** [`../docs/identity-access-model.md`](../docs/identity-access-model.md) — tenant, roluri, FlotaX ca abonat SaaS.

## Setup local

```bash
npm install
cp .env.example .env
# DATABASE_URL, JWT_SECRET, WEB_ORIGIN
npm run db:migrate
npm run db:seed
npm run start:dev
```

## Trip sheet PDF storage (GCS)

Generated FAZ / foi de parcurs PDFs are stored in **Google Cloud Storage** when `GCS_BUCKET` is set. Without it, **development** falls back to Postgres `BYTEA` (`pdfData`). In **production**, `GCS_BUCKET` is required for new documents.

| Env | Description |
|-----|-------------|
| `GCS_BUCKET` | Bucket name (e.g. `fleet-enterprise-trip-sheets`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional locally — path to service account JSON |
| (Cloud Run) | Workload Identity / attached SA — no key file needed |

**Object path:** `tenants/{tenantSlug}/trip-sheets/{documentId}.pdf`

**Download:** `GET /trip-sheets/:docId/pdf` streams the file (from GCS or legacy BYTEA). Tenant is checked via JWT before read.

### Bucket & IAM (GCP)

1. Create a regional bucket (e.g. `europe-west1`), uniform access, no public read.
2. Service account used by Cloud Run (or local dev) needs:
   - `roles/storage.objectAdmin` on the bucket (or narrower: create + get object).
3. Set `GCS_BUCKET` on the Cloud Run service.
4. Deploy API, run `npm run db:migrate` so `pdfStorageKey` / `pdfByteSize` exist.

### Backfill legacy BYTEA → GCS

After migration and bucket setup:

```bash
cd api
GCS_BUCKET=your-bucket node scripts/backfill-trip-sheet-pdf-gcs.js
# optional: TENANT_SLUG=demo
```

Clears `pdfData` after successful upload.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Demo tenants/users/vehicles |
| `npm run db:seed:trips` | Demo trips + fuel costs |
| `npm run db:seed:flotax` | Tenant pilot **FlotaX** (admin + șofer viewer); needs `PILOT_FLOTAX_PASSWORD` (CMD: `set VAR=val` **fără spații**) |
| `npm run db:verify:flotax` | Verifică tenant/useri FlotaX în DB-ul din `DATABASE_URL` |
| `npm run auth:hash-password -- "secret"` | Bcrypt hash for manual user insert |

## Tests

Requires `DATABASE_URL` in `.env` (local Postgres or Neon branch de test).

```bash
npm run test:e2e          # fleet + Q3 pilot (Client, dashboard, trip-sheet PDF)
npm run test:e2e:rbac     # JWT roles — run db:seed first
```

Pilot go-live checklist: `docs/go-live-pilot-checklist.md`.
