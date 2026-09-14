import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SIMULATED_IDENTITY_HEADERS } from '@orbit-support/shared';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

const asCustomer = (id: string) => ({ [SIMULATED_IDENTITY_HEADERS.customerId]: id });
const asStaff = (id: string, name = id) => ({
  [SIMULATED_IDENTITY_HEADERS.staffId]: id,
  [SIMULATED_IDENTITY_HEADERS.staffName]: name,
});

describe('HTTP surface (e2e, in-memory database, simulated identity)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.SUPPORT_DB_DIR;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleFixture.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports ok and labels the simulation', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', identity: 'simulated' });
  });

  it('GET /api/identity/me echoes the resolved actor with its source, and refuses missing or ambiguous identities', async () => {
    const customer = await request(app.getHttpServer()).get('/api/identity/me').set(asCustomer('cust-1')).expect(200);
    expect(customer.body).toEqual({ kind: 'customer', id: 'cust-1', source: 'simulated' });
    const staff = await request(app.getHttpServer()).get('/api/identity/me').set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(staff.body).toMatchObject({ kind: 'staff', id: 'staff-ana', role: 'agent', displayName: 'Ana', source: 'simulated' });
    await request(app.getHttpServer()).get('/api/identity/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/identity/me')
      .set({ ...asCustomer('cust-1'), ...asStaff('staff-ana') })
      .expect(401);
  });

  it('refuses customer endpoints without an identity (401) or with a staff identity (403)', async () => {
    await request(app.getHttpServer()).get('/api/support/cases').expect(401);
    await request(app.getHttpServer()).get('/api/support/cases').set(asStaff('staff-ana')).expect(403);
    await request(app.getHttpServer()).get('/api/staff/cases').set(asCustomer('cust-1')).expect(403);
  });

  it('rejects an invalid case submission with structured issues (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-1'))
      .send({ category: 'nope', message: '' })
      .expect(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual(['category', 'message']);
  });

  it('rejects an unknown staff queue view (400) and a malformed case id (400)', async () => {
    await request(app.getHttpServer()).get('/api/staff/cases?view=bogus').set(asStaff('staff-ana')).expect(400);
    await request(app.getHttpServer()).get('/api/support/cases/not-a-uuid').set(asCustomer('cust-1')).expect(400);
  });

  it('runs the PH-1 journey: customer request → staff queue → take → reply → customer sees the reply', async () => {
    const server = app.getHttpServer();

    const created = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-alice'))
      .send({ category: 'deposits_withdrawals', message: 'Meu saque não chegou', clientMessageId: 'e2e-1' })
      .expect(201);
    expect(created.body.reference).toMatch(/^SUP-\d{6}$/);
    expect(created.body.status).toBe('new');
    const caseId: string = created.body.id;

    // Another customer cannot see it (404, not 403: existence is not revealed).
    await request(server).get(`/api/support/cases/${caseId}`).set(asCustomer('cust-bob')).expect(404);

    const queue = await request(server).get('/api/staff/cases?view=unassigned').set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(queue.body.map((c: { id: string }) => c.id)).toContain(caseId);

    const taken = await request(server).post(`/api/staff/cases/${caseId}/take`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(taken.body).toMatchObject({ assignedAgentId: 'staff-ana', status: 'in_progress' });

    await request(server)
      .post(`/api/staff/cases/${caseId}/messages`)
      .set(asStaff('staff-ana', 'Ana'))
      .send({ body: 'Olá! Estou verificando seu saque.' })
      .expect(201);

    const customerView = await request(server).get(`/api/support/cases/${caseId}`).set(asCustomer('cust-alice')).expect(200);
    expect(customerView.body.messages).toHaveLength(2);
    expect(customerView.body.messages[1]).toMatchObject({ authorType: 'staff', authorName: 'Ana' });

    const list = await request(server).get('/api/support/cases').set(asCustomer('cust-alice')).expect(200);
    expect(list.body.map((c: { id: string }) => c.id)).toEqual([caseId]);
  });
});
