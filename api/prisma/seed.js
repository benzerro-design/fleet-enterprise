/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { seedTripsForTenant } = require(path.join(__dirname, '..', 'scripts', 'seed-trips-demo.js'));

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

  if (process.env.SEED_SKIP_TRIPS === '1') {
    // eslint-disable-next-line no-console
    console.log('SEED_SKIP_TRIPS=1 — sărit popularea curse demo.');
  } else {
    const tripsSeed = await seedTripsForTenant('demo', prisma);
    // eslint-disable-next-line no-console
    console.log(
      `Demo trips: ${tripsSeed.tripCount} curse, ${tripsSeed.fuelCount} alimentări combustibil, ${tripsSeed.vehicleCount} vehicule.`,
    );
  }

  await seedDemoClientUsers(demoTenant.id, passwordHash);
}

async function seedDemoClientUsers(tenantId, passwordHash) {
  const alpha = await prisma.client.findFirst({
    where: { tenantId, code: { equals: 'Client Alpha', mode: 'insensitive' } },
  });
  if (!alpha) {
    // eslint-disable-next-line no-console
    console.log('Client Alpha lipsește — sărit useri client demo (rulează seed trips).');
    return;
  }

  const driverEntity = await prisma.driver.findFirst({
    where: { tenantId, clientId: alpha.id },
    orderBy: { createdAt: 'asc' },
  });

  const users = [
    {
      email: 'manager.alpha@demo.local',
      displayName: 'Manager Alpha',
      role: 'client_admin',
      driverId: null,
    },
    {
      email: 'sofer.alpha@demo.local',
      displayName: 'Sofer Alpha',
      role: 'driver',
      driverId: driverEntity?.id ?? null,
    },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, passwordHash, displayName: u.displayName },
      update: { displayName: u.displayName },
    });
    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId } },
      create: { userId: user.id, tenantId, role: 'client_user' },
      update: { role: 'client_user' },
    });
    if (u.role === 'driver' && !u.driverId) {
      // eslint-disable-next-line no-console
      console.log(`Sărit ${u.email} — lipsește entitate Driver pe Client Alpha.`);
      continue;
    }
    await prisma.clientMembership.upsert({
      where: {
        userId_tenantId_clientId: { userId: user.id, tenantId, clientId: alpha.id },
      },
      create: {
        tenantId,
        clientId: alpha.id,
        userId: user.id,
        role: u.role,
        driverId: u.driverId,
      },
      update: { role: u.role, driverId: u.driverId },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Demo client users: manager.alpha@demo.local (L1), sofer.alpha@demo.local (L0)');
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
    console.error('Seed failed:', e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) {
      // eslint-disable-next-line no-console
      console.error(e.stack);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
