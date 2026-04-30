/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

/** Parolă demo comună (schimb-o în producție). Ambele conturi o folosesc ca să nu fie confuzie la login local. */
const DEMO_PASSWORD = 'demo12345';
const DEMO_ADMIN_EMAIL = 'admin@demo.local';
const DEMO_VIEWER_EMAIL = 'viewer@demo.local';

async function main() {
  const tenants = [
    { slug: 'default', name: 'Default tenant' },
    { slug: 'demo', name: 'Demo tenant' },
  ];

  for (const t of tenants) {
    await prisma.tenant.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, name: t.name },
      update: { name: t.name },
    });
  }

  const demoTenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    create: {
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      displayName: 'Demo admin',
    },
    update: {
      passwordHash,
      displayName: 'Demo admin',
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: { userId: admin.id, tenantId: demoTenant.id },
    },
    create: {
      userId: admin.id,
      tenantId: demoTenant.id,
      role: 'tenant_admin',
    },
    update: { role: 'tenant_admin' },
  });

  const viewer = await prisma.user.upsert({
    where: { email: DEMO_VIEWER_EMAIL },
    create: {
      email: DEMO_VIEWER_EMAIL,
      passwordHash,
      displayName: 'Demo viewer',
    },
    update: {
      passwordHash,
      displayName: 'Demo viewer',
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: { userId: viewer.id, tenantId: demoTenant.id },
    },
    create: {
      userId: viewer.id,
      tenantId: demoTenant.id,
      role: 'tenant_viewer',
    },
    update: { role: 'tenant_viewer' },
  });
}

main()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Seed completed.');
    // eslint-disable-next-line no-console
    console.log(
      `Admin: ${DEMO_ADMIN_EMAIL} / tenant: demo / password: ${DEMO_PASSWORD} (rol: tenant_admin)`,
    );
    console.log(
      `Viewer: ${DEMO_VIEWER_EMAIL} / tenant: demo / aceeași parolă: ${DEMO_PASSWORD} (rol: tenant_viewer — doar citire flotă)`,
    );
    console.log(
      'Dacă viewer lipsea din baza ta, rulează din nou: npm run db:seed (în folderul api).',
    );
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
