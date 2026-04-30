import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('FleetController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('creates and lists vehicles (tenant scoped)', async () => {
    const tenant = 'tenant-e2e';
    const registrationNumber = `E2E ${randomUUID().slice(0, 10)}`;

    const created = await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set('X-Tenant-Id', tenant)
      .send({
        clientId: 'client-1',
        registrationNumber,
        type: 'van_lt_3_5',
        itpExpiresOn: '2030-01-15T00:00:00.000Z',
        itpStationName: 'RAR București',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      tenantId: tenant,
      registrationNumber,
      type: 'van_lt_3_5',
    });

    const listed = await request(app.getHttpServer())
      .get('/fleet/vehicles')
      .set('X-Tenant-Id', tenant)
      .expect(200);

    expect(Array.isArray(listed.body.items)).toBe(true);
    expect(listed.body.total).toBeGreaterThanOrEqual(1);
    expect(listed.body.items.map((v: { id: string }) => v.id)).toContain(created.body.id);
  });

  it('does not leak vehicles across tenants', async () => {
    const a = 'tenant-a';
    const b = 'tenant-b';
    const regA = `E2E-A ${randomUUID().slice(0, 8)}`;
    const regB = `E2E-B ${randomUUID().slice(0, 8)}`;

    const vA = await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set('X-Tenant-Id', a)
      .send({
        clientId: 'client-a',
        registrationNumber: regA,
        type: 'car',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set('X-Tenant-Id', b)
      .send({
        clientId: 'client-b',
        registrationNumber: regB,
        type: 'car',
      })
      .expect(201);

    const listedA = await request(app.getHttpServer())
      .get('/fleet/vehicles')
      .set('X-Tenant-Id', a)
      .expect(200);

    expect(listedA.body.items.map((v: { id: string }) => v.id)).toContain(vA.body.id);
    expect(listedA.body.items.map((v: { registrationNumber: string }) => v.registrationNumber)).not.toContain(
      regB,
    );
  });

  it('deletes a vehicle (tenant scoped)', async () => {
    const tenant = 'tenant-e2e-delete';
    const registrationNumber = `E2E-DEL ${randomUUID().slice(0, 8)}`;

    const created = await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set('X-Tenant-Id', tenant)
      .send({
        clientId: 'client-del',
        registrationNumber,
        type: 'car',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/fleet/vehicles/${created.body.id}`)
      .set('X-Tenant-Id', tenant)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/fleet/vehicles/${created.body.id}`)
      .set('X-Tenant-Id', tenant)
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
