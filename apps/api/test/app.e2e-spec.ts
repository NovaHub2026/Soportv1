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

  it('lifecycle endpoints: staff set status and resolve; customers cannot; validation and conflicts are explicit', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-lia'))
      .send({ category: 'operations', message: 'Operação não liquidou' })
      .expect(201);
    const id: string = created.body.id;

    await request(server).post(`/api/staff/cases/${id}/status`).set(asCustomer('cust-lia')).send({ status: 'waiting_customer' }).expect(403);
    await request(server).post(`/api/staff/cases/${id}/status`).set(asStaff('staff-ana', 'Ana')).send({ status: 'resolved' }).expect(400);
    const waiting = await request(server).post(`/api/staff/cases/${id}/status`).set(asStaff('staff-ana', 'Ana')).send({ status: 'waiting_customer' }).expect(200);
    expect(waiting.body).toMatchObject({ status: 'waiting_customer', assignedAgentId: 'staff-ana' });

    await request(server).post(`/api/staff/cases/${id}/resolve`).set(asStaff('staff-ana', 'Ana')).send({ reason: 'solved', explanation: '   ' }).expect(400);
    const resolved = await request(server)
      .post(`/api/staff/cases/${id}/resolve`)
      .set(asStaff('staff-ana', 'Ana'))
      .send({ reason: 'answered', explanation: 'A operação foi liquidada às 10:31 com o preço de referência X.' })
      .expect(200);
    expect(resolved.body).toMatchObject({ status: 'resolved', resolutionReason: 'answered' });
    await request(server).post(`/api/staff/cases/${id}/resolve`).set(asStaff('staff-ana', 'Ana')).send({ reason: 'solved', explanation: 'x' }).expect(409);

    const customerView = await request(server).get(`/api/support/cases/${id}`).set(asCustomer('cust-lia')).expect(200);
    expect(customerView.body.status).toBe('resolved');
    expect(customerView.body.messages.at(-1).body).toContain('liquidada às 10:31');
  });

  it('assignment respects ownership and roles; attribute edits are validated (PH-3.3)', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-otto'))
      .send({ category: 'other', message: 'Transferir' })
      .expect(201);
    const id: string = created.body.id;
    const supervisor = { ...asStaff('staff-carla', 'Carla'), [SIMULATED_IDENTITY_HEADERS.staffRole]: 'supervisor' };

    await request(server).post(`/api/staff/cases/${id}/take`).set(asStaff('staff-ana', 'Ana')).expect(200);
    await request(server).post(`/api/staff/cases/${id}/assign`).set(asStaff('staff-bruno', 'Bruno')).send({ agentId: 'staff-bruno' }).expect(403);
    await request(server).post(`/api/staff/cases/${id}/assign`).set(asCustomer('cust-otto')).send({ agentId: 'staff-bruno' }).expect(403);
    const bySupervisor = await request(server).post(`/api/staff/cases/${id}/assign`).set(supervisor).send({ agentId: 'staff-bruno' }).expect(200);
    expect(bySupervisor.body.assignedAgentId).toBe('staff-bruno');
    const released = await request(server).post(`/api/staff/cases/${id}/assign`).set(asStaff('staff-bruno', 'Bruno')).send({ agentId: null }).expect(200);
    expect(released.body.assignedAgentId).toBeNull();

    await request(server).patch(`/api/staff/cases/${id}`).set(asStaff('staff-ana', 'Ana')).send({}).expect(400);
    await request(server).patch(`/api/staff/cases/${id}`).set(asStaff('staff-ana', 'Ana')).send({ priority: 'critical' }).expect(400);
    const patched = await request(server).patch(`/api/staff/cases/${id}`).set(asStaff('staff-ana', 'Ana')).send({ priority: 'high' }).expect(200);
    expect(patched.body.priority).toBe('high');
  });

  it('notes and consultations are staff-only and drive the waiting_internal status (PH-3.2)', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-nina'))
      .send({ category: 'bonuses_promotions', message: 'Bônus não creditado' })
      .expect(201);
    const id: string = created.body.id;

    await request(server).post(`/api/staff/cases/${id}/notes`).set(asCustomer('cust-nina')).send({ body: 'tentativa' }).expect(403);
    await request(server).post(`/api/staff/cases/${id}/notes`).set(asStaff('staff-ana', 'Ana')).send({ body: '   ' }).expect(400);
    const note = await request(server).post(`/api/staff/cases/${id}/notes`).set(asStaff('staff-ana', 'Ana')).send({ body: 'NOTA: checar regra do bônus' }).expect(201);
    expect(note.body.visibility).toBe('internal');

    await request(server).post(`/api/staff/cases/${id}/consultations`).set(asStaff('staff-ana', 'Ana')).send({ team: 'marketing', question: 'x' }).expect(400);
    const consultation = await request(server)
      .post(`/api/staff/cases/${id}/consultations`)
      .set(asStaff('staff-ana', 'Ana'))
      .send({ team: 'finance', question: 'O bônus da campanha X foi aplicado?' })
      .expect(201);
    expect(consultation.body).toMatchObject({ team: 'finance', status: 'open' });

    const customerView = await request(server).get(`/api/support/cases/${id}`).set(asCustomer('cust-nina')).expect(200);
    expect(customerView.body.status).toBe('waiting_internal');
    expect(JSON.stringify(customerView.body)).not.toContain('NOTA: checar');
    expect(JSON.stringify(customerView.body)).not.toContain('campanha X');

    const answered = await request(server)
      .post(`/api/staff/cases/${id}/consultations/${consultation.body.id}/answer`)
      .set(asStaff('staff-bruno', 'Bruno'))
      .send({ answer: 'Aplicado em 10/09; rollover pendente.' })
      .expect(200);
    expect(answered.body).toMatchObject({ status: 'answered', answeredByName: 'Bruno' });
    await request(server)
      .post(`/api/staff/cases/${id}/consultations/${consultation.body.id}/answer`)
      .set(asStaff('staff-bruno', 'Bruno'))
      .send({ answer: 'de novo' })
      .expect(409);
    const staffView = await request(server).get(`/api/staff/cases/${id}`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(staffView.body.status).toBe('in_progress');
    expect(staffView.body.consultations[0].answer).toContain('rollover');
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
    expect(list.body[0].unreadCount).toBe(1); // the staff reply, not yet read

    const read = await request(server).post(`/api/support/cases/${caseId}/read`).set(asCustomer('cust-alice')).expect(200);
    expect(read.body.customerLastReadAt).not.toBeNull();
    const after = await request(server).get('/api/support/cases').set(asCustomer('cust-alice')).expect(200);
    expect(after.body[0].unreadCount).toBe(0);
    await request(server).post(`/api/support/cases/${caseId}/read`).set(asCustomer('cust-bob')).expect(404);
    await request(server).post(`/api/staff/cases/${caseId}/read`).set(asStaff('staff-ana', 'Ana')).expect(200);
  });
});
