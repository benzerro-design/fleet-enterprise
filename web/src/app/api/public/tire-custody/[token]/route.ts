import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyUpstreamResponse } from "@/lib/api-proxy-response";

async function proxy(req: NextRequest, token: string, suffix: string) {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const url = `${apiUrl}/public/tire-custody/${encodeURIComponent(token)}${suffix}`;
  const headers: Record<string, string> = {};
  const ct = req.headers.get("content-type");
  if (ct && req.method !== "GET" && req.method !== "HEAD") headers["Content-Type"] = ct;
  const hasBody = req.method === "POST" || req.method === "PATCH" || req.method === "PUT";
  const body = hasBody ? await req.text() : undefined;
  const res = await fetch(url, { method: req.method, headers, body, cache: "no-store" });
  const out = new Headers();
  const rct = res.headers.get("content-type");
  if (rct) out.set("Content-Type", rct);
  const buf = await res.arrayBuffer();
  return proxyUpstreamResponse(res, buf, out);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token?.trim()) {
    return NextResponse.json({ message: "token required" }, { status: 400 });
  }
  return proxy(req, token, "");
}
