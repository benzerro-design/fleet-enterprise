import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

function tenantHeader(slug: string): Record<string, string> {
  return { 'X-Tenant-Id': slug };
}

describe('Q3 pilot flows (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Client CRUD, vehicle linked by client code, tenant isolation', async () => {
    const tenantA = `pilot-a-${randomUUID().slice(0, 8)}`;
    const tenantB = `pilot-b-${randomUUID().slice(0, 8)}`;
    const codeA = `CLI-${randomUUID().slice(0, 6)}`;

    const clientA = await request(app.getHttpServer())
      .post('/clients')
      .set(tenantHeader(tenantA))
      .send({ code: codeA, legalName: 'Pilot Client Alpha' })
      .expect(201);

    expect(clientA.body).toMatchObject({
      code: codeA,
      legalName: 'Pilot Client Alpha',
      status: 'active',
    });

    const reg = `PILOT ${randomUUID().slice(0, 8)}`;
    const vehicle = await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set(tenantHeader(tenantA))
      .send({
        clientId: codeA,
        registrationNumber: reg,
        type: 'car',
      })
      .expect(201);

    expect(vehicle.body.clientId).toBe(codeA);

    const clientGet = await request(app.getHttpServer())
      .get(`/clients/${clientA.body.id}`)
      .set(tenantHeader(tenantA))
      .expect(200);

    expect(clientGet.body.vehicleCount).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get(`/clients/${clientA.body.id}`)
      .set(tenantHeader(tenantB))
      .expect(404);

    const listB = await request(app.getHttpServer())
      .get('/clients')
      .set(tenantHeader(tenantB))
      .expect(200);

    expect(listB.body.items.map((c: { code: string }) => c.code)).not.toContain(codeA);
  });

  it('GET /fleet/dashboard returns KPI snapshot for tenant', async () => {
    const tenant = `pilot-dash-${randomUUID().slice(0, 8)}`;
    const code = `DASH-${randomUUID().slice(0, 6)}`;

    await request(app.getHttpServer())
      .post('/clients')
      .set(tenantHeader(tenant))
      .send({ code, legalName: 'Dashboard E2E Client' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set(tenantHeader(tenant))
      .send({ clientId: code, registrationNumber: `DASH ${randomUUID().slice(0, 6)}`, type: 'car' })
      .expect(201);

    const dash = await request(app.getHttpServer())
      .get('/fleet/dashboard')
      .set(tenantHeader(tenant))
      .expect(200);

    expect(dash.body).toMatchObject({
      kpis: expect.objectContaining({
        vehiclesActive: expect.any(Number),
        vehiclesTotal: expect.any(Number),
      }),
      links: expect.objectContaining({
        vehiclesActive: expect.stringContaining('/fleet/vehicles'),
        remindersNeedingAction: expect.stringContaining('/fleet/reminders'),
      }),
      itpSoon: expect.any(Array),
      remindersDue: expect.any(Array),
    });
    expect(dash.body.kpis.vehiclesTotal).toBeGreaterThanOrEqual(1);
  });

  it('trip-sheet generate and download PDF (BYTEA in e2e — no GCS_BUCKET)', async () => {
    const tenant = `pilot-faz-${randomUUID().slice(0, 8)}`;
    const code = `FAZ-${randomUUID().slice(0, 6)}`;

    await request(app.getHttpServer())
      .post('/clients')
      .set(tenantHeader(tenant))
      .send({ code, legalName: 'FAZ E2E Client' })
      .expect(201);

    const vehicle = await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set(tenantHeader(tenant))
      .send({
        clientId: code,
        registrationNumber: `FAZ ${randomUUID().slice(0, 6)}`,
        type: 'van_lt_3_5',
      })
      .expect(201);

    const doc = await request(app.getHttpServer())
      .post('/trip-sheets/generate')
      .set(tenantHeader(tenant))
      .send({
        docType: 'trip_sheet',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        vehicleIds: [vehicle.body.id],
        driverName: 'E2E Driver',
        clientId: code,
      })
      .expect(201);

    expect(doc.body).toMatchObject({
      id: expect.any(String),
      docType: 'trip_sheet',
    });

    await request(app.getHttpServer())
      .get(`/trip-sheets/${doc.body.id}/pdf`)
      .set(tenantHeader(tenant))
      .expect(200)
      .expect('Content-Type', /pdf/i)
      .expect((res) => {
        const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
        expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
      });
  });

  it('tenant B cannot download tenant A trip-sheet PDF', async () => {
    const tenantA = `pilot-pdf-a-${randomUUID().slice(0, 8)}`;
    const tenantB = `pilot-pdf-b-${randomUUID().slice(0, 8)}`;
    const code = `PDF-${randomUUID().slice(0, 6)}`;

    await request(app.getHttpServer())
      .post('/clients')
      .set(tenantHeader(tenantA))
      .send({ code, legalName: 'PDF isolation A' })
      .expect(201);

    const vehicle = await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set(tenantHeader(tenantA))
      .send({ clientId: code, registrationNumber: `PDF ${randomUUID().slice(0, 6)}`, type: 'car' })
      .expect(201);

    const doc = await request(app.getHttpServer())
      .post('/trip-sheets/generate')
      .set(tenantHeader(tenantA))
      .send({
        docType: 'faz_monthly',
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        vehicleIds: [vehicle.body.id],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/trip-sheets/${doc.body.id}/pdf`)
      .set(tenantHeader(tenantB))
      .expect(404);
  });
});
