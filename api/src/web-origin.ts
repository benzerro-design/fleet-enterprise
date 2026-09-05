/**
 * Public web origin used in invite / email links.
 * WEB_ORIGIN on Cloud Run must be the real Cloud Run URL
 * (e.g. https://fleet-web-stg-1096713529891.europe-west1.run.app),
 * not a truncated host like fleet-web-stg.-run.app.
 */
export function resolveWebOrigin(): string {
  const raw = (
    process.env.WEB_ORIGIN?.trim() ||
    process.env.WEB_PUBLIC_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
  return raw;
}

/** Empty substitution often yields `*.-run.app`, which has no valid cert. */
export function webOriginLooksBroken(origin: string): boolean {
  try {
    const href = origin.includes('://') ? origin : `https://${origin}`;
    const host = new URL(href).hostname.toLowerCase();
    return (
      /\.-run\.app$/.test(host) ||
      /-\.run\.app$/.test(host) ||
      host === 'example-web-url.run.app'
    );
  } catch {
    return true;
  }
}

export function buildPublicUrl(pathAfterOrigin: string): string {
  const base = resolveWebOrigin();
  const path = pathAfterOrigin.startsWith('/') ? pathAfterOrigin : `/${pathAfterOrigin}`;
  return `${base}${path}`;
}
