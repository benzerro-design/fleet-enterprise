import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyUpstreamResponse } from "@/lib/api-proxy-response";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token?.trim()) {
    return NextResponse.json({ message: "token required" }, { status: 400 });
  }
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const url = `${apiUrl}/public/tire-custody/${encodeURIComponent(token)}/sign`;
  const headers: Record<string, string> = {};
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  const body = await req.text();
  const res = await fetch(url, { method: "POST", headers, body, cache: "no-store" });
  const out = new Headers();
  const rct = res.headers.get("content-type");
  if (rct) out.set("Content-Type", rct);
  const buf = await res.arrayBuffer();
  return proxyUpstreamResponse(res, buf, out);
}
