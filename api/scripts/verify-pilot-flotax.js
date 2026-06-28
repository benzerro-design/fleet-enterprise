/**
 * Verifică dacă conturile FlotaX există în DB-ul curent (DATABASE_URL).
 * Utilizare: npm run db:verify:flotax
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const TENANT_SLUG = 'flotax';
const EMAILS = ['flotax_admin@flotax.local'];

const prisma = new PrismaClient();

function databaseHostLabel() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return '(DATABASE_URL lipsă)';
  try {
    return new URL(raw.replace(/^postgresql:/, 'http:')).hostname;
  } catch {
    return '(invalid)';
  }
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`DATABASE host: ${databaseHostLabel()}`);

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  // eslint-disable-next-line no-console
  console.log(tenant ? `Tenant "${TENANT_SLUG}": OK (${tenant.name})` : `Tenant "${TENANT_SLUG}": LIPSEȘTE`);

  for (const email of EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { tenant: true } } },
    });
    if (!user) {
      // eslint-disable-next-line no-console
      console.log(`${email}: LIPSEȘTE`);
      continue;
    }
    const m = user.memberships.find((x) => x.tenant.slug === TENANT_SLUG);
    // eslint-disable-next-line no-console
    console.log(`${email}: OK (rol: ${m?.role ?? 'fără membership flotax'})`);
  }
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
