import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyUpstreamResponse } from "@/lib/api-proxy-response";

const COOKIE = "fleet_access";

function upstreamUrl(req: NextRequest, segments: string[] | undefined): string {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const suffix = segments?.length ? segments.join("/") : "";
  const path = suffix ? `/partner/reports/${suffix}` : "/partner/reports";
  return `${apiUrl}${path}${req.nextUrl.search}`;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { path: segments } = await ctx.params;
  const url = upstreamUrl(req, segments);
  const upstream = await fetch(url, {
    method: req.method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const outHeaders = new Headers();
  const uct = upstream.headers.get("content-type");
  if (uct) outHeaders.set("Content-Type", uct);
  const cd = upstream.headers.get("content-disposition");
  if (cd) outHeaders.set("Content-Disposition", cd);
  const buf = await upstream.arrayBuffer();
  return proxyUpstreamResponse(upstream, buf, outHeaders);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
