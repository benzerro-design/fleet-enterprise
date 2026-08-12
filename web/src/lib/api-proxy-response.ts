import { NextResponse } from "next/server";

/** Statusuri care nu pot avea body (altfel Next/undici aruncă → 500 în UI). */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * Construiește răspunsul proxy către client din upstream.
 * Pentru 204/205/304 body-ul trebuie să fie null.
 */
export function proxyUpstreamResponse(
  upstream: Response,
  buf: ArrayBuffer,
  headers: Headers,
): NextResponse {
  if (NULL_BODY_STATUSES.has(upstream.status)) {
    return new NextResponse(null, { status: upstream.status });
  }
  return new NextResponse(buf, { status: upstream.status, headers });
}
