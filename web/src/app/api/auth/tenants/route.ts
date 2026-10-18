import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const jar = await cookies();
  const token = jar.get("fleet_access")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const upstream = await fetch(`${apiUrl}/auth/tenants`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
