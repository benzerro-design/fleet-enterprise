import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type JwtFleetPayload = {
  role?: string;
  clientPortal?: "fleet" | "tickets";
};

function jwtPayload(token: string): JwtFleetPayload | undefined {
  try {
    const part = token.split(".")[1];
    if (!part) return undefined;
    const json = Buffer.from(part, "base64url").toString("utf8");
    return JSON.parse(json) as JwtFleetPayload;
  } catch {
    return undefined;
  }
}

/** Rute permise managerului/dispecerului client (flotă scoped). */
const CLIENT_FLEET_PREFIXES = [
  "/fleet/dashboard",
  "/fleet/vehicles",
  "/fleet/trips",
  "/fleet/documents",
  "/fleet/reminders",
  "/fleet/maintenance",
  "/fleet/costs",
  "/fleet/drivers",
  "/fleet/clients",
  "/fleet/tickets",
];

const CLIENT_FLEET_HOME = "/fleet/dashboard";
const CLIENT_TICKETS_HOME = "/fleet/tickets";

function pathAllowed(prefixes: string[], pathname: string): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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

  const payload = jwtPayload(token);
  if (payload?.role !== "client_user") {
    return NextResponse.next();
  }

  const portal = payload.clientPortal ?? "tickets";

  if (portal === "tickets") {
    if (!pathname.startsWith("/fleet/tickets")) {
      return NextResponse.redirect(new URL(CLIENT_TICKETS_HOME, request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/fleet/members") || pathname.startsWith("/fleet/audit")) {
    return NextResponse.redirect(new URL(CLIENT_FLEET_HOME, request.url));
  }

  if (pathname === "/fleet" || pathname === "/fleet/") {
    return NextResponse.redirect(new URL(CLIENT_FLEET_HOME, request.url));
  }

  if (!pathAllowed(CLIENT_FLEET_PREFIXES, pathname)) {
    return NextResponse.redirect(new URL(CLIENT_FLEET_HOME, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/fleet/:path*"],
};
