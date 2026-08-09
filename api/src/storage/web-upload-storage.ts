import { Storage } from '@google-cloud/storage';

const UPLOAD_KINDS = new Set(['documents', 'tickets', 'invoices']);

export type WebUploadRef = { kind: string; fileName: string };

/**
 * Parsează URL-uri publice de tip `/uploads/{kind}/{file}` (relative sau absolute pe web).
 */
export function parseWebUploadUrl(rawUrl: string): WebUploadRef | null {
  try {
    const trimmed = rawUrl.trim();
    const path = /^https?:\/\//i.test(trimmed) ? new URL(trimmed).pathname : trimmed;
    const m = /^\/uploads\/(documents|tickets|invoices)\/([^/?#]+)$/i.exec(path);
    if (!m) return null;
    const kind = m[1].toLowerCase();
    if (!UPLOAD_KINDS.has(kind)) return null;
    const fileName = decodeURIComponent(m[2]);
    if (!fileName || fileName.includes('..') || fileName.includes('/')) return null;
    return { kind, fileName };
  } catch {
    return null;
  }
}

function guessContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

let storageSingleton: Storage | null = null;

function getStorage(): Storage {
  if (!storageSingleton) storageSingleton = new Storage();
  return storageSingleton;
}

/**
 * Citește un upload web din același GCS_BUCKET (prefix uploads/…).
 * Evită HTTP server-to-server web↔API pe Cloud Run (cauză frecventă: „fetch failed”).
 */
export async function readWebUploadFromGcs(
  ref: WebUploadRef,
): Promise<{ data: Buffer; contentType: string } | null> {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) return null;
  const key = `uploads/${ref.kind}/${ref.fileName}`;
  try {
    const file = getStorage().bucket(bucket).file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [data] = await file.download();
    const [meta] = await file.getMetadata();
    const contentType =
      typeof meta.contentType === 'string' && meta.contentType
        ? meta.contentType
        : guessContentType(ref.fileName);
    return { data: Buffer.from(data), contentType };
  } catch {
    return null;
  }
}
