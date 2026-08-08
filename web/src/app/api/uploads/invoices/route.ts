import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { persistUpload } from "@/lib/upload-storage";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = "application/pdf";

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "invoice.bin";
}

export async function POST(req: Request) {
  const token = (await cookies()).get("fleet_access")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const maybeFile = form.get("file");
  const invoiceNumberRaw = form.get("invoiceNumber");
  const invoiceNumber =
    typeof invoiceNumberRaw === "string" ? invoiceNumberRaw.trim() : "";
  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ message: "Missing file" }, { status: 400 });
  }

  if (maybeFile.size <= 0 || maybeFile.size > MAX_SIZE) {
    return NextResponse.json({ message: "Fișier invalid (max 10MB)." }, { status: 400 });
  }

  const ct = maybeFile.type || "application/octet-stream";
  if (ct !== ALLOWED_MIME) {
    return NextResponse.json(
      { message: "Tip fișier neacceptat. Se permite doar PDF." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await maybeFile.arrayBuffer());
  const original = sanitizeFilename(maybeFile.name);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const inv = invoiceNumber
    ? sanitizeFilename(invoiceNumber).replace(/\.+/g, "_")
    : "fara_numar_factura";
  const finalName = `${stamp}-${inv}-${original}`;

  const { url } = await persistUpload({
    kind: "invoices",
    fileName: finalName,
    bytes,
    contentType: ct,
  });

  return NextResponse.json({ url, name: original });
}
