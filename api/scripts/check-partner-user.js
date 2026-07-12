const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const u = await p.user.findUnique({
    where: { email: 'partner@alphaservice.local' },
    include: {
      memberships: { include: { tenant: true } },
      supplierMemberships: { include: { supplier: true, tenant: true } },
    },
  });
  if (!u) {
    console.log('MISSING: partner@alphaservice.local — rulează npm run db:seed');
    process.exit(1);
  }
  const sm = u.supplierMemberships[0];
  const tm = u.memberships[0];
  console.log('OK:', u.email);
  console.log('  tenant:', sm?.tenant?.slug ?? tm?.tenant?.slug);
  console.log('  role:', tm?.role);
  console.log('  supplier:', sm?.supplier?.code, sm?.supplier?.legalName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
