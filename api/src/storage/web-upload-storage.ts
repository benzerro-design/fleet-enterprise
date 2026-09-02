import { Storage } from '@google-cloud/storage';

const UPLOAD_KINDS = new Set(['documents', 'tickets', 'invoices']);

export type WebUploadRef = { kind: string; fileName: string };

export class WebUploadLoadError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'timeout' | 'network' | 'http' | 'invalid',
  ) {
    super(message);
    this.name = 'WebUploadLoadError';
  }
}

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

/** Aceeași cheie ca web `uploadObjectKey` (caractere în afara [A-Za-z0-9._-] → _). */
export function webUploadObjectKey(kind: string, fileName: string): string {
  const safeKind = kind.replace(/[^a-z]/g, '');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `uploads/${safeKind}/${safeName}`;
}

let storageSingleton: Storage | null = null;

function getStorage(): Storage {
  if (!storageSingleton) storageSingleton = new Storage();
  return storageSingleton;
}

function isNotFoundError(e: unknown): boolean {
  const code = (e as { code?: number | string } | null)?.code;
  return code === 404 || code === '404';
}

function errorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

/**
 * Citește un upload web din același GCS_BUCKET (prefix uploads/…).
 * Evită HTTP server-to-server web↔API pe Cloud Run (cauză frecventă: „fetch failed”).
 */
export async function readWebUploadFromGcs(
  ref: WebUploadRef,
): Promise<{ data: Buffer; contentType: string } | null> {
  const hit = await readWebUploadFromGcsDetailed(ref);
  return hit.ok ? { data: hit.data, contentType: hit.contentType } : null;
}

export type GcsReadDetailed =
  | { ok: true; data: Buffer; contentType: string; key: string }
  | { ok: false; reason: 'no_bucket' }
  | { ok: false; reason: 'not_found'; key: string }
  | { ok: false; reason: 'error'; key: string; message: string };

async function downloadGcsObject(
  bucketName: string,
  key: string,
  fileName: string,
): Promise<GcsReadDetailed> {
  try {
    const file = getStorage().bucket(bucketName).file(key);
    const [data] = await file.download();
    let contentType = guessContentType(fileName);
    try {
      const [meta] = await file.getMetadata();
      if (typeof meta.contentType === 'string' && meta.contentType) {
        contentType = meta.contentType;
      }
    } catch {
      /* contentType din extensie e suficient */
    }
    return { ok: true, data: Buffer.from(data), contentType, key };
  } catch (e) {
    if (isNotFoundError(e)) return { ok: false, reason: 'not_found', key };
    return { ok: false, reason: 'error', key, message: errorText(e) };
  }
}

export async function readWebUploadFromGcsDetailed(ref: WebUploadRef): Promise<GcsReadDetailed> {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) return { ok: false, reason: 'no_bucket' };

  const primary = webUploadObjectKey(ref.kind, ref.fileName);
  const rawKey = `uploads/${ref.kind}/${ref.fileName}`;
  const keys = primary === rawKey ? [primary] : [primary, rawKey];

  let last: GcsReadDetailed = { ok: false, reason: 'not_found', key: primary };
  for (const key of keys) {
    last = await downloadGcsObject(bucket, key, ref.fileName);
    if (last.ok) return last;
    if (last.reason === 'error') {
      console.warn(`[web-upload] GCS ${key}: ${last.message}`);
      return last;
    }
  }
  return last;
}

function resolveHttpUrl(rawUrl: string, webOrigin: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('/') && webOrigin) return `${webOrigin}${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function httpTimeoutMs(webOrigin: string): number {
  if (/localhost|127\.0\.0\.1/i.test(webOrigin)) return 25_000;
  return 120_000;
}

async function fetchUploadOverHttp(
  url: string,
  timeoutMs: number,
): Promise<{ data: Buffer; contentType: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    const msg = errorText(e).toLowerCase();
    if (name === 'AbortError' || msg.includes('aborted')) {
      throw new WebUploadLoadError(
        `Timeout la descărcarea scanului (${Math.round(timeoutMs / 1000)}s). PDF-urile CIV mari trebuie citite din GCS.`,
        'timeout',
      );
    }
    const cause = e instanceof Error ? (e as Error & { cause?: { message?: string } }).cause : undefined;
    const detail = cause?.message ? `${errorText(e)} (${cause.message})` : errorText(e);
    throw new WebUploadLoadError(
      detail === 'fetch failed' || msg.includes('fetch failed')
        ? 'Nu am putut descărca scanul CIV (rețea Cloud Run). Verifică GCS_BUCKET + roles/storage.objectViewer pe SA API.'
        : detail,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new WebUploadLoadError(`Nu am putut descărca scanul (HTTP ${res.status})`, 'http');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType =
    res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
  return { data: buf, contentType };
}

/**
 * Bytes din `/uploads/...`: GCS (Cloud Run) apoi HTTP pe WEB_ORIGIN (dev / fallback).
 */
export async function loadWebUploadBytes(
  rawUrl: string,
): Promise<{ buf: Buffer; contentType: string }> {
  const uploadRef = parseWebUploadUrl(rawUrl);
  let gcsNote = '';

  if (uploadRef) {
    const gcs = await readWebUploadFromGcsDetailed(uploadRef);
    if (gcs.ok) {
      return { buf: gcs.data, contentType: gcs.contentType };
    }
    if (gcs.reason === 'error') {
      gcsNote = `GCS: ${gcs.message}. `;
    } else if (gcs.reason === 'not_found') {
      gcsNote = `GCS: obiect negăsit (${gcs.key}). `;
    }
  }

  const webOrigin = (process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
  const url = resolveHttpUrl(rawUrl, webOrigin);
  if (!url) {
    throw new WebUploadLoadError(
      uploadRef
        ? `${gcsNote}Scan CIV negăsit în GCS. Reîncarcă documentul CIV (cu fișier) și reîncearcă.`
        : 'fileUrl trebuie să fie absolut sau relative pe WEB_ORIGIN',
      'not_found',
    );
  }

  try {
    const hit = await fetchUploadOverHttp(url, httpTimeoutMs(webOrigin));
    return { buf: hit.data, contentType: hit.contentType };
  } catch (e) {
    if (e instanceof WebUploadLoadError && gcsNote) {
      throw new WebUploadLoadError(`${gcsNote}${e.message}`, e.code);
    }
    throw e;
  }
}
