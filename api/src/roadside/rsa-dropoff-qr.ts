/** RSA-S3 — payload QR destinatar (oglindit în web/src/lib/rsa-offline-queue). */

export function rsaMissionDropoffQrPayload(input: {
  missionId: string;
  dropoffLocationText?: string | null;
  vehicleReg?: string | null;
}): string {
  const parts = [`FE:rsa-mission:${input.missionId}`];
  if (input.vehicleReg?.trim()) parts.push(`veh:${input.vehicleReg.trim()}`);
  if (input.dropoffLocationText?.trim()) parts.push(`to:${input.dropoffLocationText.trim()}`);
  return parts.join("|");
}

export function rsaDropoffMapsUrl(dropoffLocationText: string | null | undefined): string | null {
  const t = dropoffLocationText?.trim();
  if (!t) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
}
