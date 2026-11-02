/**
 * RSA-S3 — coadă offline IndexedDB pentru mutații teren (PV / misiune).
 * Flush FIFO când revine online.
 */

import { uploadDocumentFile } from "@/lib/document-upload";
import {
  addRsaMedia,
  addRsaSignature,
  finalizeRsaProtocol,
  patchRsaMission,
  patchRsaProtocol,
  type RsaHandoverMediaKind,
  type RsaHandoverSignerRole,
  type RsaMissionStatus,
} from "@/lib/roadside-api";

const DB_NAME = "fleet-rsa-offline-v1";
const STORE = "ops";
const DB_VERSION = 1;

export type RsaOfflineOpType =
  | "patch_protocol"
  | "add_signature"
  | "add_media"
  | "finalize_protocol"
  | "patch_mission";

export type RsaOfflineOp = {
  id: string;
  type: RsaOfflineOpType;
  createdAt: string;
  protocolId?: string;
  missionId?: string;
  /** JSON-serializable payload; blobs as base64 data URLs. */
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let req: IDBRequest<T> | undefined;
    try {
      const r = fn(store);
      if (r) req = r;
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => {
      resolve(req ? req.result : undefined);
      db.close();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error("IDB tx failed"));
      db.close();
    };
  });
}

export function newOfflineOpId(): string {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const RSA_OFFLINE_QUEUE_EVENT = "rsa-offline-queue-changed";

function notifyQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RSA_OFFLINE_QUEUE_EVENT));
}

export async function enqueueRsaOfflineOp(
  partial: Omit<RsaOfflineOp, "id" | "createdAt" | "attempts"> & { id?: string },
): Promise<RsaOfflineOp> {
  const op: RsaOfflineOp = {
    id: partial.id ?? newOfflineOpId(),
    type: partial.type,
    createdAt: new Date().toISOString(),
    protocolId: partial.protocolId,
    missionId: partial.missionId,
    payload: partial.payload,
    attempts: 0,
    lastError: null,
  };
  await withStore("readwrite", (store) => store.put(op));
  notifyQueueChanged();
  return op;
}

export async function listRsaOfflineOps(): Promise<RsaOfflineOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as RsaOfflineOp[]) ?? [];
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
      db.close();
    };
    req.onerror = () => {
      reject(req.error);
      db.close();
    };
  });
}

export async function countRsaOfflineOps(): Promise<number> {
  const rows = await listRsaOfflineOps();
  return rows.length;
}

export async function removeRsaOfflineOp(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  notifyQueueChanged();
}

export async function updateRsaOfflineOp(op: RsaOfflineOp): Promise<void> {
  await withStore("readwrite", (store) => store.put(op));
  notifyQueueChanged();
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

async function executeOp(op: RsaOfflineOp): Promise<void> {
  switch (op.type) {
    case "patch_protocol": {
      if (!op.protocolId) throw new Error("protocolId missing");
      await patchRsaProtocol(op.protocolId, op.payload as Parameters<typeof patchRsaProtocol>[1]);
      return;
    }
    case "add_signature": {
      if (!op.protocolId) throw new Error("protocolId missing");
      const pngDataUrl = String(op.payload.pngDataUrl ?? "");
      const role = op.payload.role as RsaHandoverSignerRole;
      const displayName = String(op.payload.displayName ?? "");
      const file = dataUrlToFile(pngDataUrl, `sig-${role}-offline.png`);
      const up = await uploadDocumentFile(file, `rsa-sig-${role}`);
      await addRsaSignature(op.protocolId, {
        role,
        displayName,
        signaturePngUrl: up.url,
        strokePathJson: op.payload.strokePathJson,
        deviceMetaJson: {
          ...(typeof op.payload.deviceMetaJson === "object" && op.payload.deviceMetaJson
            ? (op.payload.deviceMetaJson as object)
            : {}),
          offlineQueuedAt: op.createdAt,
          offlineOpId: op.id,
        },
      });
      return;
    }
    case "add_media": {
      if (!op.protocolId) throw new Error("protocolId missing");
      const dataUrl = String(op.payload.dataUrl ?? "");
      const kind = op.payload.kind as RsaHandoverMediaKind;
      const fileName = String(op.payload.fileName ?? `media-${kind}.jpg`);
      const file = dataUrlToFile(dataUrl, fileName);
      const up = await uploadDocumentFile(file, `rsa-${kind}`);
      await addRsaMedia(op.protocolId, {
        kind,
        fileUrl: up.url,
        fileName: up.name,
        caption: typeof op.payload.caption === "string" ? op.payload.caption : null,
      });
      return;
    }
    case "finalize_protocol": {
      if (!op.protocolId) throw new Error("protocolId missing");
      await finalizeRsaProtocol(op.protocolId);
      return;
    }
    case "patch_mission": {
      if (!op.missionId) throw new Error("missionId missing");
      await patchRsaMission(
        op.missionId,
        op.payload as {
          status?: RsaMissionStatus;
          cancelReason?: string | null;
          distanceKm?: number | null;
        },
      );
      return;
    }
    default:
      throw new Error(`Unknown offline op ${(op as RsaOfflineOp).type}`);
  }
}

export type FlushResult = {
  flushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

/** Procesează coada în ordine. Se oprește la primul eșec (păstrează ordinea). */
export async function flushRsaOfflineQueue(): Promise<FlushResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const remaining = await countRsaOfflineOps();
    return { flushed: 0, failed: 0, remaining, errors: ["offline"] };
  }
  const ops = await listRsaOfflineOps();
  let flushed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const op of ops) {
    try {
      await executeOp(op);
      await removeRsaOfflineOp(op.id);
      flushed += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${op.type}: ${msg}`);
      await updateRsaOfflineOp({
        ...op,
        attempts: op.attempts + 1,
        lastError: msg,
      });
      break;
    }
  }

  const remaining = await countRsaOfflineOps();
  return { flushed, failed, remaining, errors };
}

/** Payload QR destinatar misiune RSA. */
export function rsaMissionDropoffQrPayload(input: {
  missionId: string;
  dropoffLocationText?: string | null;
  vehicleReg?: string | null;
}): string {
  const parts = [`FE:rsa-mission:${input.missionId}`];
  if (input.vehicleReg?.trim()) parts.push(`veh:${input.vehicleReg.trim()}`);
  if (input.dropoffLocationText?.trim()) parts.push(`to:${input.dropoffLocationText.trim()}`);
  return parts.join("|");
}

export function rsaDropoffMapsUrl(dropoffLocationText: string | null | undefined): string | null {
  const t = dropoffLocationText?.trim();
  if (!t) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
}

export function rsaQrImageUrl(payload: string, sizePx = 160): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&data=${encodeURIComponent(payload)}`;
}
