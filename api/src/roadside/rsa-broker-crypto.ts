import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

export function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function last4OfSecret(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.length <= 4 ? t : t.slice(-4);
}

export function secretsEqual(plain: string, hashHex: string | null | undefined): boolean {
  if (!hashHex?.trim()) return false;
  const a = Buffer.from(sha256Hex(plain), 'utf8');
  const b = Buffer.from(hashHex.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sealKey(): Buffer {
  const material =
    process.env.RSA_BROKER_SEAL_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'dev-rsa-broker-seal-key';
  return createHash('sha256').update(material, 'utf8').digest();
}

/** AES-256-GCM — `iv:tag:cipher` hex. */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function unsealSecret(sealed: string | null | undefined): string | null {
  if (!sealed?.trim()) return null;
  const parts = sealed.trim().split(':');
  if (parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const out = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return out.toString('utf8');
  } catch {
    return null;
  }
}

export function hashBrokerSecretForStorage(raw: string | null | undefined): {
  hash: string | null;
  last4: string | null;
  sealed: string | null;
} {
  const t = raw?.trim();
  if (!t) return { hash: null, last4: null, sealed: null };
  return { hash: sha256Hex(t), last4: last4OfSecret(t), sealed: sealSecret(t) };
}
