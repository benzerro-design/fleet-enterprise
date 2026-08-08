import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Storage } from "@google-cloud/storage";

export type UploadKind = "documents" | "tickets" | "invoices";

const storageSingleton: { current: Storage | null } = { current: null };

function gcsBucket(): string | null {
  const name = process.env.GCS_BUCKET?.trim();
  return name && name.length > 0 ? name : null;
}

function getStorage(): Storage {
  if (!storageSingleton.current) {
    storageSingleton.current = new Storage();
  }
  return storageSingleton.current;
}

export function uploadObjectKey(kind: UploadKind, fileName: string): string {
  const safeKind = kind.replace(/[^a-z]/g, "");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `uploads/${safeKind}/${safeName}`;
}

export function publicUploadUrl(kind: UploadKind, fileName: string): string {
  return `/uploads/${kind}/${fileName}`;
}

function localPath(kind: UploadKind, fileName: string): string {
  return path.join(process.cwd(), "public", "uploads", kind, fileName);
}

/**
 * Persistă un upload. Cu `GCS_BUCKET` → GCS (supraviețuiește redeploy).
 * Fără bucket → `public/uploads/...` (dev local).
 * URL-ul public rămâne `/uploads/{kind}/{file}` (servit de route GET + rewrite).
 */
export async function persistUpload(opts: {
  kind: UploadKind;
  fileName: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ url: string; storage: "gcs" | "local" }> {
  const { kind, fileName, bytes, contentType } = opts;
  const bucket = gcsBucket();
  const url = publicUploadUrl(kind, fileName);

  if (bucket) {
    const key = uploadObjectKey(kind, fileName);
    await getStorage()
      .bucket(bucket)
      .file(key)
      .save(Buffer.from(bytes), {
        resumable: false,
        contentType: contentType || "application/octet-stream",
        metadata: { cacheControl: "private, max-age=0" },
      });
    return { url, storage: "gcs" };
  }

  const abs = localPath(kind, fileName);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return { url, storage: "local" };
}

export async function readUpload(
  kind: UploadKind,
  fileName: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeName || safeName !== fileName) return null;

  const bucket = gcsBucket();
  if (bucket) {
    try {
      const key = uploadObjectKey(kind, safeName);
      const file = getStorage().bucket(bucket).file(key);
      const [exists] = await file.exists();
      if (!exists) {
        // fallback local (dev / migrație)
      } else {
        const [data] = await file.download();
        const [meta] = await file.getMetadata();
        const contentType =
          typeof meta.contentType === "string" && meta.contentType
            ? meta.contentType
            : guessContentType(safeName);
        return { data: Buffer.from(data), contentType };
      }
    } catch {
      /* try local */
    }
  }

  try {
    const data = await readFile(localPath(kind, safeName));
    return { data, contentType: guessContentType(safeName) };
  } catch {
    return null;
  }
}

function guessContentType(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return map[ext] ?? "application/octet-stream";
}

export function isUploadKind(raw: string): raw is UploadKind {
  return raw === "documents" || raw === "tickets" || raw === "invoices";
}
