const INVITE_PATH = /\/invite(?:\/partner)?\/[A-Za-z0-9_-]+/;

export function invitePathFromUrl(url: string): string | null {
  const match = url.match(INVITE_PATH);
  return match ? match[0] : null;
}

/**
 * Linkurile din API folosesc WEB_ORIGIN. Dacă e greșit
 * (ex. https://fleet-web-stg.-run.app/...), reconstruim
 * /invite/... pe hostul pe care e logat adminul.
 */
export function toBrowserInviteUrl(url: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  const path = invitePathFromUrl(url);
  if (path) return `${base}${path}`;
  return url;
}
