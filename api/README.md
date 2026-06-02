# Fleet Enterprise API (NestJS)

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
| `npm run auth:hash-password -- "secret"` | Bcrypt hash for manual user insert |

## Tests

```bash
npm run test:e2e
npm run test:e2e:rbac
```
