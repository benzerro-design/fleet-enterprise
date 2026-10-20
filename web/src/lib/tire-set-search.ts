export const TIRE_SET_QR_PREFIX = "FE:tire-set:";

export function parseTireSetSearchInput(
  raw: string,
): { kind: "setId"; setId: string } | { kind: "plate"; plate: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "plate", plate: "" };
  }
  if (trimmed.toUpperCase().startsWith(TIRE_SET_QR_PREFIX.toUpperCase())) {
    const setId = trimmed.slice(TIRE_SET_QR_PREFIX.length).trim();
    if (setId) return { kind: "setId", setId };
  }
  if (/^c[a-z0-9]{20,}$/i.test(trimmed)) {
    return { kind: "setId", setId: trimmed };
  }
  const plate = trimmed.replace(/\s+/g, "").toUpperCase();
  return { kind: "plate", plate };
}

/** Live field formatting: upper-case plates only; preserve set id / QR id casing. */
export function formatTireSetSearchFieldOnChange(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  if (trimmed.toUpperCase().startsWith(TIRE_SET_QR_PREFIX.toUpperCase())) {
    const lead = raw.match(/^\s*/)?.[0] ?? "";
    const body = raw.slice(lead.length);
    const prefixMatch = body.match(/^FE:tire-set:/i);
    if (prefixMatch) {
      const idPart = body.slice(prefixMatch[0].length);
      return lead + TIRE_SET_QR_PREFIX + idPart;
    }
  }

  const parsed = parseTireSetSearchInput(raw);
  if (parsed.kind === "setId") return raw;

  const compact = trimmed.replace(/\s+/g, "");
  if (/^c[a-z0-9]*$/i.test(compact)) return raw;

  return raw.toUpperCase();
}

export function parseIntakePhotoUrlsInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeIntakePhotoUrls(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((url) => url.trim())
      .filter(Boolean);
  }
  return [];
}

/** MVP intake photos stored as HTTPS URLs or data URLs (no upload service). */
export const INTAKE_PHOTO_MAX_COUNT = 3;
export const INTAKE_PHOTO_MAX_BYTES = 400_000;

export function mergeIntakePhotoUrls(urlsFromText: string[], fileDataUrls: string[]): string[] {
  const merged = [...fileDataUrls, ...urlsFromText].map((u) => u.trim()).filter(Boolean);
  return merged.slice(0, INTAKE_PHOTO_MAX_COUNT);
}

export function readIntakePhotoFilesAsDataUrls(
  files: FileList | File[],
  opts?: { maxCount?: number; maxBytes?: number },
): Promise<{ dataUrls: string[]; errors: string[] }> {
  const maxCount = opts?.maxCount ?? INTAKE_PHOTO_MAX_COUNT;
  const maxBytes = opts?.maxBytes ?? INTAKE_PHOTO_MAX_BYTES;
  const list = Array.from(files).slice(0, maxCount);

  return Promise.all(
    list.map(
      (file) =>
        new Promise<{ dataUrl?: string; error?: string }>((resolve) => {
          if (!file.type.startsWith("image/")) {
            resolve({ error: `${file.name}: doar imagini` });
            return;
          }
          if (file.size > maxBytes) {
            resolve({
              error: `${file.name}: max ${Math.round(maxBytes / 1024)}KB`,
            });
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            if (!result.startsWith("data:image/")) {
              resolve({ error: `${file.name}: format invalid` });
              return;
            }
            resolve({ dataUrl: result });
          };
          reader.onerror = () => resolve({ error: `${file.name}: citire eșuată` });
          reader.readAsDataURL(file);
        }),
    ),
  ).then((rows) => {
    const dataUrls: string[] = [];
    const errors: string[] = [];
    for (const row of rows) {
      if (row.dataUrl) dataUrls.push(row.dataUrl);
      if (row.error) errors.push(row.error);
    }
    return { dataUrls, errors };
  });
}

/** External QR image (api.qrserver.com) — optional; copy payload remains primary. */
export function tireSetQrImageUrl(payload: string, sizePx = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&data=${encodeURIComponent(payload)}`;
}
