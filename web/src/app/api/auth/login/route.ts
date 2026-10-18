import { NextResponse } from "next/server";

const COOKIE = "fleet_access";

export async function POST(req: Request) {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const upstream = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  let parsed: {
    accessToken?: string;
    requiresTenant?: boolean;
    tenants?: Array<{ slug: string; name: string; role: string }>;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return NextResponse.json({ message: "Invalid upstream response" }, { status: 502 });
  }

  // PARTNER-018 — multi-abonat: UI alege tenant după parolă.
  if (parsed.requiresTenant && Array.isArray(parsed.tenants)) {
    return NextResponse.json({
      requiresTenant: true,
      tenants: parsed.tenants,
    });
  }

  if (!parsed.accessToken) {
    return NextResponse.json({ message: "Invalid upstream response" }, { status: 502 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, parsed.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
