/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Uploads legacy BYTEA trip-sheet PDFs to GCS and sets pdfStorageKey.
 *
 * Usage (from api/):
 *   GCS_BUCKET=your-bucket node scripts/backfill-trip-sheet-pdf-gcs.js
 *   GCS_BUCKET=your-bucket TENANT_SLUG=demo node scripts/backfill-trip-sheet-pdf-gcs.js
 */
const { PrismaClient } = require('@prisma/client');
const { Storage } = require('@google-cloud/storage');

const prisma = new PrismaClient();
const storage = new Storage();

function objectKey(tenantSlug, docId) {
  const safeSlug = tenantSlug.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `tenants/${safeSlug}/trip-sheets/${safeId}.pdf`;
}

async function main() {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) {
    console.error('Set GCS_BUCKET');
    process.exit(1);
  }
  const tenantSlugFilter = process.env.TENANT_SLUG?.trim();

  const where = {
    pdfStorageKey: null,
    pdfData: { not: null },
    ...(tenantSlugFilter ? { tenant: { slug: tenantSlugFilter } } : {}),
  };

  const rows = await prisma.tripSheetDocument.findMany({
    where,
    include: { tenant: { select: { slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  let uploaded = 0;
  for (const row of rows) {
    const key = objectKey(row.tenant.slug, row.id);
    const buf = Buffer.from(row.pdfData);
    await storage.bucket(bucket).file(key).save(buf, {
      resumable: false,
      contentType: 'application/pdf',
    });
    await prisma.tripSheetDocument.update({
      where: { id: row.id },
      data: {
        pdfStorageKey: key,
        pdfByteSize: buf.length,
        pdfData: null,
      },
    });
    uploaded += 1;
    // eslint-disable-next-line no-console
    console.log(`Uploaded ${row.id} → ${key}`);
  }

  // eslint-disable-next-line no-console
  console.log(`Backfill complete: ${uploaded} document(s).`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
