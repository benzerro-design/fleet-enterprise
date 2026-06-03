import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/** Trebuie să existe în DB după `npm run db:seed` (seed.js). */
const ADMIN = {
  email: 'admin@demo.local',
  password: 'demo12345',
  tenantSlug: 'demo',
};
const VIEWER = {
  email: 'viewer@demo.local',
  password: 'demo12345',
  tenantSlug: 'demo',
};

describe('Auth + RBAC (JWT, e2e)', () => {
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

  async function login(email: string, password: string, tenantSlug: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, tenantSlug })
      .expect(200);
    const token = res.body.accessToken as string | undefined;
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(10);
    return token!;
  }

  it('login admin vs viewer; GET /fleet/vehicles 200 both; viewer POST/DELETE 403; admin POST 201 DELETE 204', async () => {
    const tokenAdmin = await login(ADMIN.email, ADMIN.password, ADMIN.tenantSlug);
    const tokenViewer = await login(VIEWER.email, VIEWER.password, VIEWER.tenantSlug);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.role).toBe('tenant_admin');
        expect(res.body.tenantSlug).toBe('demo');
      });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenViewer}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.role).toBe('tenant_viewer');
        expect(res.body.tenantSlug).toBe('demo');
      });

    await request(app.getHttpServer())
      .get('/fleet/vehicles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(typeof res.body.total).toBe('number');
      });

    await request(app.getHttpServer())
      .get('/fleet/vehicles')
      .set('Authorization', `Bearer ${tokenViewer}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
      });

    const registrationNumber = `RBAC-${randomUUID().slice(0, 8)}`;
    const clientCode = `rbac-${randomUUID().slice(0, 8)}`;

    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ code: clientCode, legalName: 'RBAC E2E Client' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set('Authorization', `Bearer ${tokenViewer}`)
      .send({
        clientId: clientCode,
        registrationNumber,
        type: 'car',
      })
      .expect(403)
      .expect((res) => {
        expect(res.body.message).toContain('Insufficient role');
      });

    const created = await request(app.getHttpServer())
      .post('/fleet/vehicles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        clientId: clientCode,
        registrationNumber,
        type: 'car',
      })
      .expect(201);

    const vehicleId = created.body.id as string;

    await request(app.getHttpServer())
      .delete(`/fleet/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${tokenViewer}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/fleet/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/fleet/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${tokenViewer}`)
      .expect(404);
  });
});
