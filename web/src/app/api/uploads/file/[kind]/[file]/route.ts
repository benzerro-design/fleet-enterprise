import { NextResponse } from "next/server";
import { isUploadKind, readUpload } from "@/lib/upload-storage";

type Ctx = { params: Promise<{ kind: string; file: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { kind: kindRaw, file: fileRaw } = await ctx.params;
  if (!isUploadKind(kindRaw)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const file = decodeURIComponent(fileRaw);
  const hit = await readUpload(kindRaw, file);
  if (!hit) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(hit.data), {
    status: 200,
    headers: {
      "Content-Type": hit.contentType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${file.replace(/"/g, "")}"`,
    },
  });
}
