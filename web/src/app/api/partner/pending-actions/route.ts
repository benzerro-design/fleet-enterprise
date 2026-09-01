import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyUpstreamResponse } from "@/lib/api-proxy-response";

const COOKIE = "fleet_access";

async function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const url = `${apiUrl}/partner/pending-actions${req.nextUrl.search}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const upstream = await fetch(url, { method: "GET", headers });
  const outHeaders = new Headers();
  const uct = upstream.headers.get("content-type");
  if (uct) outHeaders.set("Content-Type", uct);
  const buf = await upstream.arrayBuffer();
  return proxyUpstreamResponse(upstream, buf, outHeaders);
}

export async function GET(req: NextRequest) {
  return proxy(req);
}
