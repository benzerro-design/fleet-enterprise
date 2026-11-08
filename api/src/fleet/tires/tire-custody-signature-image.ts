import { loadWebUploadBytes } from '../../storage/web-upload-storage';

/** Load signature PNG/JPEG from upload URL or data: URL for PDF embedding. */
export async function loadSignatureImageBuffer(
  rawUrl: string | null | undefined,
): Promise<Buffer | null> {
  const url = rawUrl?.trim();
  if (!url) return null;

  if (url.startsWith('data:image/')) {
    const comma = url.indexOf(',');
    if (comma < 0) return null;
    const meta = url.slice(0, comma);
    if (!/;base64/i.test(meta)) return null;
    try {
      return Buffer.from(url.slice(comma + 1), 'base64');
    } catch {
      return null;
    }
  }

  try {
    const hit = await loadWebUploadBytes(url);
    return hit.buf;
  } catch {
    return null;
  }
}
