/**
 * Tenant pilot FlotaX — nu modifică tenantul demo.
 *
 * Utilizare (parola NU se comite în repo):
 *
 *   CMD (fără spații în jurul =):
 *     set PILOT_FLOTAX_PASSWORD=ParolaTaSigura2026
 *     npm run db:seed:flotax
 *
 *   PowerShell:
 *     $env:PILOT_FLOTAX_PASSWORD = "ParolaTaSigura2026"
 *     npm run db:seed:flotax
 *
 * Opțional: PILOT_FLOTAX_PASSWORD_HASH=... (bcrypt) în loc de parolă clară.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const TENANT_SLUG = 'flotax';
const TENANT_NAME = 'FlotaX';

const ADMIN = {
  email: 'flotax_admin@flotax.local',
  displayName: 'FlotaX_Admin',
  role: 'tenant_admin',
};

const prisma = new PrismaClient();

function databaseHostLabel() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return '(DATABASE_URL lipsă)';
  try {
    const normalized = raw.replace(/^postgresql:/, 'http:');
    return new URL(normalized).hostname;
  } catch {
    return '(DATABASE_URL invalid)';
  }
}

async function resolvePasswordHash() {
  const hashEnv = process.env.PILOT_FLOTAX_PASSWORD_HASH?.trim();
  if (hashEnv) return hashEnv;
  const plain = process.env.PILOT_FLOTAX_PASSWORD?.trim();
  if (!plain) {
    throw new Error(
      'Setează PILOT_FLOTAX_PASSWORD (sau PILOT_FLOTAX_PASSWORD_HASH) înainte de seed.',
    );
  }
  if (plain.length < 10) {
    throw new Error('PILOT_FLOTAX_PASSWORD trebuie să aibă cel puțin 10 caractere.');
  }
  return bcrypt.hash(plain, 12);
}

async function upsertUserMembership(tenantId, { email, displayName, role }, passwordHash) {
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, displayName },
    update: { passwordHash, displayName },
  });
  await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId } },
    create: { userId: user.id, tenantId, role },
    update: { role },
  });
  return user;
}

async function removeDeprecatedSofer(tenantId) {
  const legacyEmail = 'flotax_sofer@flotax.local';
  const legacy = await prisma.user.findUnique({ where: { email: legacyEmail } });
  if (!legacy) return;
  await prisma.clientMembership.deleteMany({ where: { userId: legacy.id, tenantId } });
  await prisma.tenantMembership.deleteMany({ where: { userId: legacy.id, tenantId } });
  await prisma.user.delete({ where: { id: legacy.id } });
  // eslint-disable-next-line no-console
  console.log(`Eliminat cont depreciat: ${legacyEmail}`);
}

async function main() {
  const dbHost = databaseHostLabel();
  // eslint-disable-next-line no-console
  console.log(`DATABASE host: ${dbHost}`);
  if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
    throw new Error(
      'DATABASE_URL pointează spre localhost. Pune URI Neon în api/.env sau set DATABASE_URL=... înainte de seed.',
    );
  }

  const passwordHash = await resolvePasswordHash();

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: { slug: TENANT_SLUG, name: TENANT_NAME },
    update: { name: TENANT_NAME },
  });

  await upsertUserMembership(tenant.id, ADMIN, passwordHash);
  await removeDeprecatedSofer(tenant.id);

  const check = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  if (!check) throw new Error('Verificare eșuată: user admin lipsește după seed.');

  // eslint-disable-next-line no-console
  console.log('FlotaX pilot seed OK.');
  // eslint-disable-next-line no-console
  console.log(`Tenant slug (login): ${TENANT_SLUG}`);
  // eslint-disable-next-line no-console
  console.log(`Admin:  ${ADMIN.email}  (${ADMIN.displayName}, ${ADMIN.role})`);
  // eslint-disable-next-line no-console
  console.log('Parola: cea setată în PILOT_FLOTAX_PASSWORD (nu se afișează).');
  // eslint-disable-next-line no-console
  console.log('Useri client (șofer/manager) se creează per Client via POST /tenant/client-memberships.');
  // eslint-disable-next-line no-console
  console.log('Demo tenant (admin@demo.local) — neschimbat.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
