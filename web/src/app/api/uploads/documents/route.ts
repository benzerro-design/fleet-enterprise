import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { persistUpload } from "@/lib/upload-storage";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_CONTENT_TYPE: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "document.bin";
}

function resolveContentType(file: File): string | null {
  const declared = (file.type || "").trim().toLowerCase();
  if (ALLOWED.has(declared)) return declared;
  // Windows / unii browsere trimit PDF ca octet-stream sau fără MIME.
  const ext = file.name.includes(".")
    ? `.${file.name.split(".").pop()!.toLowerCase()}`
    : "";
  const fromExt = EXT_CONTENT_TYPE[ext];
  if (
    fromExt &&
    (!declared || declared === "application/octet-stream" || declared === "binary/octet-stream")
  ) {
    return fromExt;
  }
  return null;
}

export async function POST(req: Request) {
  const token = (await cookies()).get("fleet_access")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const maybeFile = form.get("file");
  const labelRaw = form.get("label");
  const label = typeof labelRaw === "string" ? labelRaw.trim() : "";
  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ message: "Missing file" }, { status: 400 });
  }

  if (maybeFile.size <= 0 || maybeFile.size > MAX_SIZE) {
    return NextResponse.json({ message: "Fișier invalid (max 10MB)." }, { status: 400 });
  }

  const ct = resolveContentType(maybeFile);
  if (!ct) {
    return NextResponse.json(
      { message: "Tip neacceptat. Permise: PDF, JPEG, PNG, WebP." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await maybeFile.arrayBuffer());
  const original = sanitizeFilename(maybeFile.name);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const tag = label ? sanitizeFilename(label).replace(/\.+/g, "_") : "doc";
  const finalName = `${stamp}-${tag}-${original}`;

  const { url } = await persistUpload({
    kind: "documents",
    fileName: finalName,
    bytes,
    contentType: ct,
  });

  return NextResponse.json({ url, name: original });
}
