import { NextResponse } from "next/server";

/** Răspuns corect pentru DELETE/PATCH care returnează 204 fără body de la Nest. */
export function nextResponseFromUpstream(upstream: Response): NextResponse {
  if (upstream.status === 204 || upstream.status === 205) {
    return new NextResponse(null, { status: upstream.status });
  }

  const outHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) outHeaders.set("Content-Type", contentType);

  return new NextResponse(upstream.body, { status: upstream.status, headers: outHeaders });
}
