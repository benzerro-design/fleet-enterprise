import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { persistUpload } from "@/lib/upload-storage";

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const token = (await cookies()).get("fleet_access")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const maybeFile = form.get("file");
  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ message: "Missing file" }, { status: 400 });
  }
  if (maybeFile.size <= 0 || maybeFile.size > MAX_SIZE) {
    return NextResponse.json({ message: "Fișier invalid (max 8MB)." }, { status: 400 });
  }
  const ct = maybeFile.type || "application/octet-stream";
  if (!ALLOWED.has(ct)) {
    return NextResponse.json({ message: "Doar JPG, PNG sau WebP." }, { status: 400 });
  }
  const bytes = new Uint8Array(await maybeFile.arrayBuffer());
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
  const { url } = await persistUpload({
    kind: "workorders",
    fileName: `${stamp}.${ext}`,
    bytes,
    contentType: ct,
  });
  return NextResponse.json({ url });
}
