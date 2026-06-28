import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function jwtRole(token: string): string | undefined {
  try {
    const part = token.split(".")[1];
    if (!part) return undefined;
    const json = Buffer.from(part, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { role?: string };
    return payload.role;
  } catch {
    return undefined;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/fleet")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("fleet_access")?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (jwtRole(token) === "client_user" && !pathname.startsWith("/fleet/tickets")) {
    return NextResponse.redirect(new URL("/fleet/tickets", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/fleet/:path*"],
};
