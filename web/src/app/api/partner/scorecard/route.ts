import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyUpstreamResponse } from "@/lib/api-proxy-response";

const COOKIE = "fleet_access";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const url = `${apiUrl}/partner/scorecard${req.nextUrl.search}`;
  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const buf = await upstream.arrayBuffer();
  const outHeaders = new Headers();
  const uct = upstream.headers.get("content-type");
  if (uct) outHeaders.set("Content-Type", uct);
  return proxyUpstreamResponse(upstream, buf, outHeaders);
}
