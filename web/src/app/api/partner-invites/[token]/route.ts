import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE = "fleet_access";

async function proxy(req: NextRequest, token: string, suffix: string) {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const jwt = req.cookies.get(COOKIE)?.value;
  const url = `${apiUrl}/partner-invites/${token}${suffix}`;
  const headers: Record<string, string> = {};
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(url, { method: req.method, headers });
  const out = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) out.set("Content-Type", ct);
  return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: out });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return proxy(_req, token, "");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return proxy(req, token, "/accept");
}
