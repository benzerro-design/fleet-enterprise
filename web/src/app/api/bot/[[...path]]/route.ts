import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyUpstreamResponse } from "@/lib/api-proxy-response";

const COOKIE = "fleet_access";

function upstreamUrl(req: NextRequest, segments: string[] | undefined): string {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const suffix = segments?.length ? segments.join("/") : "";
  const path = suffix ? `/bot/${suffix}` : "/bot";
  const search = req.nextUrl.search;
  return `${apiUrl}${path}${search}`;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await ctx.params;
  const url = upstreamUrl(req, segments);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const ct = req.headers.get("content-type");
  if (ct && req.method !== "GET" && req.method !== "HEAD") {
    headers["Content-Type"] = ct;
  }

  const hasBody = req.method === "POST" || req.method === "PATCH" || req.method === "PUT";
  const body = hasBody ? await req.text() : undefined;

  const upstream = await fetch(url, { method: req.method, headers, body });

  const outHeaders = new Headers();
  const uct = upstream.headers.get("content-type");
  if (uct) outHeaders.set("Content-Type", uct);

  const buf = await upstream.arrayBuffer();
  return proxyUpstreamResponse(upstream, buf, outHeaders);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
