import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SIMULATED_IDENTITY_HEADERS, STAFF_ONLY_SUMMARY_FIELDS } from '@orbit-support/shared';
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
    // PH-6.3: the outside-hours notice depends on the wall clock; keep the schedule open so every test is deterministic.
    const supervisor = { ...asStaff('staff-carla', 'Carla'), [SIMULATED_IDENTITY_HEADERS.staffRole]: 'supervisor' };
    const current = (await request(app.getHttpServer()).get('/api/staff/settings').set(supervisor).expect(200)).body;
    await request(app.getHttpServer()).put('/api/staff/settings').set(supervisor).send({ ...current, schedule: { mon: { open: '00:00', close: '23:59' }, tue: { open: '00:00', close: '23:59' }, wed: { open: '00:00', close: '23:59' }, thu: { open: '00:00', close: '23:59' }, fri: { open: '00:00', close: '23:59' }, sat: { open: '00:00', close: '23:59' }, sun: { open: '00:00', close: '23:59' } } }).expect(200);
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

  it('incident endpoints are staff-only and validated (PH-3.5)', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-rui'))
      .send({ category: 'deposits_withdrawals', message: 'Pix não caiu' })
      .expect(201);

    await request(server).post('/api/staff/incidents').set(asCustomer('cust-rui')).send({ title: 'x' }).expect(403);
    await request(server).post('/api/staff/incidents').set(asStaff('staff-ana', 'Ana')).send({ title: 'ab' }).expect(400);
    const incident = await request(server).post('/api/staff/incidents').set(asStaff('staff-ana', 'Ana')).send({ title: 'Atraso Pix' }).expect(201);
    const linked = await request(server).post(`/api/staff/cases/${created.body.id}/incident`).set(asStaff('staff-ana', 'Ana')).send({ incidentId: incident.body.id }).expect(200);
    expect(linked.body).toMatchObject({ incidentId: incident.body.id, incidentTitle: 'Atraso Pix' });
    await request(server).get('/api/staff/incidents?status=bogus').set(asStaff('staff-ana', 'Ana')).expect(400);
    const list = await request(server).get('/api/staff/incidents?status=open').set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(list.body[0]).toMatchObject({ id: incident.body.id, linkedCaseCount: 1 });
    const broadcast = await request(server).post(`/api/staff/incidents/${incident.body.id}/notes`).set(asStaff('staff-ana', 'Ana')).send({ body: 'Normalizado.' }).expect(200);
    expect(broadcast.body).toEqual({ delivered: 1 });
    const customerView = await request(server).get(`/api/support/cases/${created.body.id}`).set(asCustomer('cust-rui')).expect(200);
    expect(JSON.stringify(customerView.body.messages)).not.toContain('Normalizado');
    const resolved = await request(server).post(`/api/staff/incidents/${incident.body.id}/resolve`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(resolved.body.status).toBe('resolved');
    expect((await request(server).get(`/api/support/cases/${created.body.id}`).set(asCustomer('cust-rui')).expect(200)).body.status).toBe('new');
  });

  it('closure and follow-up endpoints (PH-3.4): close needs resolved; follow-up needs closed and ownership', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-pia'))
      .send({ category: 'operations', message: 'Fechar depois' })
      .expect(201);
    const id: string = created.body.id;

    await request(server).post(`/api/staff/cases/${id}/close`).set(asStaff('staff-ana', 'Ana')).expect(409);
    await request(server).post(`/api/support/cases/${id}/follow-up`).set(asCustomer('cust-pia')).send({ message: 'x' }).expect(409);
    await request(server).post(`/api/staff/cases/${id}/resolve`).set(asStaff('staff-ana', 'Ana')).send({ reason: 'answered', explanation: 'Pronto.' }).expect(200);
    const closed = await request(server).post(`/api/staff/cases/${id}/close`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(closed.body.status).toBe('closed');
    await request(server).post(`/api/staff/cases/${id}/close`).set(asCustomer('cust-pia')).expect(403);

    await request(server).post(`/api/support/cases/${id}/follow-up`).set(asCustomer('cust-quim')).send({ message: 'x' }).expect(404);
    await request(server).post(`/api/support/cases/${id}/follow-up`).set(asCustomer('cust-pia')).send({ message: '   ' }).expect(400);
    const child = await request(server).post(`/api/support/cases/${id}/follow-up`).set(asCustomer('cust-pia')).send({ message: 'Voltou a acontecer.' }).expect(201);
    expect(child.body).toMatchObject({ parentCaseId: id, parentReference: created.body.reference, status: 'new' });
    expect(child.body.messages[0]).toMatchObject({ authorType: 'system' });
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

  it('Cycle Audit 1: listing creates nothing, NUL bytes and unknown agents are 400, customer JSON has no staff-only fields, open consultations block resolution', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/support/cases').set(asCustomer('cust-zero')).expect(200, []);
    await request(server).get('/api/support/cases').set(asCustomer('cust-zero')).expect(200, []); // opening the panel creates nothing (§4.1)
    await request(server).post('/api/support/cases').set(asCustomer('cust-zero')).send({ category: 'other', message: 'a\u0000b' }).expect(400);

    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-zero')).send({ category: 'other', message: 'Oi' }).expect(201);
    const id: string = created.body.id;
    const incident = await request(server).post('/api/staff/incidents').set(asStaff('staff-ana', 'Ana')).send({ title: 'INTERNO: fora do ar' }).expect(201);
    await request(server).post(`/api/staff/cases/${id}/incident`).set(asStaff('staff-ana', 'Ana')).send({ incidentId: incident.body.id }).expect(200);
    await request(server).post(`/api/staff/cases/${id}/notes`).set(asStaff('staff-ana', 'Ana')).send({ body: 'a\u0000b' }).expect(400);
    await request(server).patch(`/api/staff/cases/${id}`).set(asStaff('staff-ana', 'Ana')).send({ priority: 'urgent' }).expect(200);

    const detail = await request(server).get(`/api/support/cases/${id}`).set(asCustomer('cust-zero')).expect(200);
    const list = await request(server).get('/api/support/cases').set(asCustomer('cust-zero')).expect(200);
    const read = await request(server).post(`/api/support/cases/${id}/read`).set(asCustomer('cust-zero')).expect(200);
    for (const field of STAFF_ONLY_SUMMARY_FIELDS) {
      expect(detail.body).not.toHaveProperty(field);
      expect(list.body[0]).not.toHaveProperty(field);
      expect(read.body).not.toHaveProperty(field);
    }
    expect(JSON.stringify([detail.body, list.body, read.body])).not.toContain('fora do ar');
    const staffView = await request(server).get(`/api/staff/cases/${id}`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(staffView.body).toMatchObject({ incidentTitle: 'INTERNO: fora do ar', priority: 'urgent' });

    await request(server).post(`/api/staff/cases/${id}/take`).set(asStaff('staff-ana', 'Ana')).expect(200);
    const ghost = await request(server).post(`/api/staff/cases/${id}/assign`).set(asStaff('staff-ana', 'Ana')).send({ agentId: 'ghost-agent' }).expect(400);
    expect(ghost.body).toMatchObject({ error: 'unknown_agent' });

    const consultation = await request(server).post(`/api/staff/cases/${id}/consultations`).set(asStaff('staff-ana', 'Ana')).send({ team: 'finance', question: 'Saldo?' }).expect(201);
    await request(server).post(`/api/staff/cases/${id}/resolve`).set(asStaff('staff-ana', 'Ana')).send({ reason: 'solved', explanation: 'Feito' }).expect(409);
    await request(server).post(`/api/staff/cases/${id}/consultations/${consultation.body.id}/answer`).set(asStaff('staff-bruno', 'Bruno')).send({ answer: 'ok' }).expect(200);
    await request(server).post(`/api/staff/cases/${id}/resolve`).set(asStaff('staff-ana', 'Ana')).send({ reason: 'solved', explanation: 'Feito' }).expect(200);
  });


  it('PH-4.1: staff read the customer\'s Orbit summary — masked, labeled, or explicitly unavailable; customers cannot', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-alice')).send({ category: 'other', message: 'Contexto' }).expect(201);
    const id: string = created.body.id;
    await request(server).get(`/api/staff/cases/${id}/orbit`).set(asCustomer('cust-alice')).expect(403);
    await request(server).get('/api/staff/cases/11111111-1111-4111-8111-111111111111/orbit').set(asStaff('staff-ana', 'Ana')).expect(404);

    const context = await request(server).get(`/api/staff/cases/${id}/orbit`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(context.body.customer).toMatchObject({ state: 'available', source: 'simulated', data: { username: 'alice.souza', emailMasked: 'a***@e***.com' } });
    expect(context.text).not.toContain('alice.souza@');
    expect(context.text).not.toContain('99999');

    const stranger = await request(server).post('/api/support/cases').set(asCustomer('cust-ghost')).send({ category: 'other', message: 'Quem?' }).expect(201);
    const missing = await request(server).get(`/api/staff/cases/${stranger.body.id}/orbit`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(missing.body.customer).toMatchObject({ state: 'unavailable', reason: 'not_found' });

    process.env.SUPPORT_SIMULATED_ORBIT = 'unavailable';
    try {
      const outage = await request(server).get(`/api/staff/cases/${id}/orbit`).set(asStaff('staff-ana', 'Ana')).expect(200);
      expect(outage.body.customer).toMatchObject({ state: 'unavailable', reason: 'unavailable' });
    } finally {
      delete process.env.SUPPORT_SIMULATED_ORBIT;
    }
    const health = await request(server).get('/api/health').expect(200);
    expect(health.body.orbitRecords).toBe('simulated');
  });


  it('PH-4.2: customers list their own records with active cases flagged, open a case from one, and staff see snapshot and current state', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/support/records').set(asStaff('staff-ana', 'Ana')).expect(403);
    const list = await request(server).get('/api/support/records').set(asCustomer('cust-alice')).expect(200);
    expect(list.body.records.state).toBe('available');
    expect(list.body.records.data.map((r: { reference: string }) => r.reference)).toEqual(['WD-48213', 'OP-901223', 'PIX-77110']);
    expect(list.body.records.data[0]).toMatchObject({ kind: 'withdrawal', activeCaseId: null });
    expect(list.text).not.toContain('example.com');
    const nobody = await request(server).get('/api/support/records').set(asCustomer('cust-nobody')).expect(200);
    expect(nobody.body.records).toMatchObject({ state: 'unavailable', reason: 'not_found' });

    const created = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-alice'))
      .send({ category: 'deposits_withdrawals', message: 'Saque não chegou', record: { kind: 'withdrawal', reference: 'WD-48213' } })
      .expect(201);
    expect(created.body.record).toMatchObject({ kind: 'withdrawal', reference: 'WD-48213', lookupReason: null, snapshot: { title: 'Saque 250 USDT' } });
    const again = await request(server).get('/api/support/records').set(asCustomer('cust-alice')).expect(200);
    expect(again.body.records.data[0]).toMatchObject({ reference: 'WD-48213', activeCaseId: created.body.id, activeCaseReference: created.body.reference });

    await request(server).post('/api/support/cases').set(asCustomer('cust-alice')).send({ category: 'other', message: 'x', record: { kind: 'nope', reference: 'WD-48213' } }).expect(400);
    const foreign = await request(server)
      .post('/api/support/cases')
      .set(asCustomer('cust-bob'))
      .send({ category: 'other', message: 'Esse saque é meu?', record: { kind: 'withdrawal', reference: 'WD-48213' } })
      .expect(201);
    expect(foreign.body.record).toMatchObject({ snapshot: null, lookupReason: 'not_found' });
    expect(foreign.text).not.toContain('Saque 250');

    const context = await request(server).get(`/api/staff/cases/${created.body.id}/orbit`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(context.body.record).toMatchObject({ state: 'available', data: { reference: 'WD-48213', status: 'Em processamento' } });
    const staffView = await request(server).get(`/api/staff/cases/${created.body.id}`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(staffView.body.record.snapshot.title).toBe('Saque 250 USDT');
  });


  it('PH-5.1: every view is reachable, pagination is validated, and a resolved case leaves the active views', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-view')).send({ category: 'other', message: 'Vista' }).expect(201);
    const id: string = created.body.id;
    await request(server).get('/api/staff/cases?view=bogus').set(asStaff('staff-ana', 'Ana')).expect(400);
    await request(server).get('/api/staff/cases?view=active&limit=1000').set(asStaff('staff-ana', 'Ana')).expect(400);
    const one = await request(server).get('/api/staff/cases?view=active&limit=1').set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(one.body).toHaveLength(1);
    await request(server).post(`/api/staff/cases/${id}/resolve`).set(asStaff('staff-ana', 'Ana')).send({ reason: 'solved', explanation: 'ok' }).expect(200);
    const resolved = await request(server).get('/api/staff/cases?view=resolved').set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(resolved.body.map((c: { id: string }) => c.id)).toContain(id);
    const active = await request(server).get('/api/staff/cases?view=active&limit=200').set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(active.body.map((c: { id: string }) => c.id)).not.toContain(id);
    await request(server).get('/api/staff/cases?view=closed').set(asCustomer('cust-view')).expect(403);
  });


  it('PH-5.2: staff search by reference, customer and record; over-long terms are refused', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-alice')).send({ category: 'deposits_withdrawals', message: 'Busca', record: { kind: 'withdrawal', reference: 'WD-48213' } }).expect(201);
    for (const q of [created.body.reference, 'WD-48213', 'cust-alice', 'busca']) {
      const found = await request(server).get(`/api/staff/cases?view=active&limit=200&q=${encodeURIComponent(q)}`).set(asStaff('staff-ana', 'Ana')).expect(200);
      expect(found.body.map((c: { id: string }) => c.id)).toContain(created.body.id);
    }
    const none = await request(server).get('/api/staff/cases?view=active&q=nada-disso').set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(none.body).toEqual([]);
    await request(server).get(`/api/staff/cases?view=active&q=${'x'.repeat(101)}`).set(asStaff('staff-ana', 'Ana')).expect(400);
    await request(server).get('/api/staff/cases?view=active&q=SUP').set(asCustomer('cust-alice')).expect(403);
  });


  it('PH-5.3: saved replies are team templates — any staff creates, only the author or a supervisor edits or removes, customers never see them', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/staff/saved-replies').set(asCustomer('cust-alice')).expect(403);
    await request(server).post('/api/staff/saved-replies').set(asStaff('staff-ana', 'Ana')).send({ title: '', body: 'x' }).expect(400);
    const created = await request(server)
      .post('/api/staff/saved-replies')
      .set(asStaff('staff-ana', 'Ana'))
      .send({ title: 'Saque em análise', body: 'Seu saque está em análise pelo time financeiro. Retornamos em breve.', category: 'deposits_withdrawals' })
      .expect(201);
    expect(created.body).toMatchObject({ createdById: 'staff-ana', updatedByName: 'Ana', category: 'deposits_withdrawals' });
    const list = await request(server).get('/api/staff/saved-replies').set(asStaff('staff-bruno', 'Bruno')).expect(200);
    expect(list.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
    await request(server).patch(`/api/staff/saved-replies/${created.body.id}`).set(asStaff('staff-bruno', 'Bruno')).send({ title: 'x', body: 'y' }).expect(403);
    const supervisor = { ...asStaff('staff-carla', 'Carla'), [SIMULATED_IDENTITY_HEADERS.staffRole]: 'supervisor' };
    const edited = await request(server).patch(`/api/staff/saved-replies/${created.body.id}`).set(supervisor).send({ title: 'Saque em análise (v2)', body: 'Texto novo' }).expect(200);
    expect(edited.body).toMatchObject({ title: 'Saque em análise (v2)', updatedById: 'staff-carla', category: null });
    await request(server).delete(`/api/staff/saved-replies/${created.body.id}`).set(asStaff('staff-bruno', 'Bruno')).expect(403);
    await request(server).delete(`/api/staff/saved-replies/${created.body.id}`).set(asStaff('staff-ana', 'Ana')).expect(204);
    await request(server).delete(`/api/staff/saved-replies/${created.body.id}`).set(asStaff('staff-ana', 'Ana')).expect(404);
  });


  it('PH-5.4: availability is computed from the configured schedule; supervision and settings are supervisor-only', async () => {
    const server = app.getHttpServer();
    const supervisor = { ...asStaff('staff-carla', 'Carla'), [SIMULATED_IDENTITY_HEADERS.staffRole]: 'supervisor' };
    const availability = await request(server).get('/api/support/availability').set(asCustomer('cust-alice')).expect(200);
    // The e2e setup saves an always-open schedule (PH-6.3), so the working default is no longer in force here.
    expect(availability.body).toMatchObject({ timezone: 'America/Sao_Paulo', workingDefault: false, openNow: true });
    expect(typeof availability.body.openNow).toBe('boolean');
    await request(server).get('/api/support/availability').set(asStaff('staff-ana', 'Ana')).expect(403);
    await request(server).get('/api/staff/overview').set(asStaff('staff-ana', 'Ana')).expect(403);
    await request(server).get('/api/staff/metrics?days=7').set(asStaff('staff-ana', 'Ana')).expect(403);
    await request(server).get('/api/staff/metrics?days=999').set(supervisor).expect(400);
    const overview = await request(server).get('/api/staff/overview').set(supervisor).expect(200);
    expect(overview.body).toHaveProperty('byStatus');
    const metrics = await request(server).get('/api/staff/metrics?days=30').set(supervisor).expect(200);
    expect(metrics.body).toMatchObject({ periodDays: 30, targets: null });
    const current = await request(server).get('/api/staff/settings').set(asStaff('staff-ana', 'Ana')).expect(200);
    await request(server).put('/api/staff/settings').set(asStaff('staff-ana', 'Ana')).send(current.body).expect(403);
    await request(server).put('/api/staff/settings').set(supervisor).send({ ...current.body, schedule: { ...current.body.schedule, sat: { open: '10:00', close: '14:00' } }, attentionThresholdHours: 0 }).expect(400);
    const saved = await request(server).put('/api/staff/settings').set(supervisor).send({ timezone: 'America/Sao_Paulo', schedule: { ...current.body.schedule, sat: { open: '10:00', close: '14:00' } }, attentionThresholdHours: 8, followUpWindowDays: 10 }).expect(200);
    expect(saved.body).toMatchObject({ workingDefault: false, updatedById: 'staff-carla', attentionThresholdHours: 8, followUpWindowDays: 10 });
    const again = await request(server).get('/api/support/availability').set(asCustomer('cust-alice')).expect(200);
    expect(again.body.workingDefault).toBe(false);
  });


  it('PH-6.1: customers read and mark their own notifications; staff and other customers cannot', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-notify')).send({ category: 'other', message: 'Aviso?' }).expect(201);
    await request(server).post(`/api/staff/cases/${created.body.id}/messages`).set(asStaff('staff-ana', 'Ana')).send({ body: 'Olá!' }).expect(201);
    await request(server).get('/api/support/notifications').set(asStaff('staff-ana', 'Ana')).expect(403);
    const mine = await request(server).get('/api/support/notifications').set(asCustomer('cust-notify')).expect(200);
    expect(mine.body.unread).toBe(1);
    expect(mine.body.notifications[0]).toMatchObject({ kind: 'staff_reply', caseReference: created.body.reference, readAt: null });
    expect(mine.text).not.toContain('Olá!');
    const theirs = await request(server).get('/api/support/notifications').set(asCustomer('cust-other')).expect(200);
    expect(theirs.body).toEqual({ notifications: [], unread: 0 });
    await request(server).post('/api/support/notifications/read').set(asCustomer('cust-other')).send({ ids: [mine.body.notifications[0].id] }).expect(200);
    expect((await request(server).get('/api/support/notifications').set(asCustomer('cust-notify')).expect(200)).body.unread).toBe(1);
    await request(server).post('/api/support/notifications/read').set(asCustomer('cust-notify')).send({ ids: ['not-a-uuid'] }).expect(400);
    const marked = await request(server).post('/api/support/notifications/read').set(asCustomer('cust-notify')).send({}).expect(200);
    expect(marked.body).toEqual({ marked: 1, unread: 0 });
  });


  it('PH-6.2: customers manage their e-mail preference and see only their own simulated outbox; staff cannot', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/support/emails').set(asStaff('staff-ana', 'Ana')).expect(403);
    const prefs = await request(server).get('/api/support/preferences').set(asCustomer('cust-alice')).expect(200);
    expect(prefs.body).toMatchObject({ emailNotifications: true, updatedAt: null });
    await request(server).put('/api/support/preferences').set(asCustomer('cust-alice')).send({ emailNotifications: 'yes' }).expect(400);
    const off = await request(server).put('/api/support/preferences').set(asCustomer('cust-alice')).send({ emailNotifications: false }).expect(200);
    expect(off.body.emailNotifications).toBe(false);
    await request(server).put('/api/support/preferences').set(asCustomer('cust-alice')).send({ emailNotifications: true }).expect(200);
    const outbox = await request(server).get('/api/support/emails').set(asCustomer('cust-alice')).expect(200);
    expect(outbox.body).toMatchObject({ delivery: 'simulated' });
    expect(Array.isArray(outbox.body.emails)).toBe(true);
    expect(outbox.text).not.toContain('alice.souza@');
  });


  it('PH-7.3 privacy re-check: internal notes, consultations and incident broadcasts never reach the customer detail, notifications or outbox under the role model', async () => {
    const server = app.getHttpServer();
    const owner = asStaff('staff-ana', 'Ana');
    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-priv')).send({ category: 'operations', message: 'Minha ordem não executou.' }).expect(201);
    const id = created.body.id;
    await request(server).post(`/api/staff/cases/${id}/messages`).set(owner).send({ body: 'Estamos verificando.' }).expect(201);
    await request(server).post(`/api/staff/cases/${id}/notes`).set(asStaff('staff-bruno', 'Bruno')).send({ body: 'NOTA-SIGILOSA: cliente já reclamou antes' }).expect(201);
    const consultation = await request(server).post(`/api/staff/cases/${id}/consultations`).set(owner).send({ team: 'finance', question: 'PERGUNTA-INTERNA sobre saldo' }).expect(201);
    await request(server).post(`/api/staff/cases/${id}/consultations/${consultation.body.id}/answer`).set(asStaff('staff-bruno', 'Bruno')).send({ answer: 'RESPOSTA-INTERNA com dados' }).expect(200);
    const incident = await request(server).post('/api/staff/incidents').set(owner).send({ title: 'INCIDENTE-TITULO' }).expect(201);
    await request(server).post(`/api/staff/cases/${id}/incident`).set(owner).send({ incidentId: incident.body.id }).expect(200);
    await request(server).post(`/api/staff/incidents/${incident.body.id}/notes`).set(owner).send({ body: 'BROADCAST-INTERNO para todos os casos' }).expect(200);
    const secrets = ['NOTA-SIGILOSA', 'PERGUNTA-INTERNA', 'RESPOSTA-INTERNA', 'BROADCAST-INTERNO', 'INCIDENTE-TITULO', 'incidentId', 'assignedAgentId', 'staffLastReadAt'];
    const detail = await request(server).get(`/api/support/cases/${id}`).set(asCustomer('cust-priv')).expect(200);
    const list = await request(server).get('/api/support/cases').set(asCustomer('cust-priv')).expect(200);
    const notifications = await request(server).get('/api/support/notifications').set(asCustomer('cust-priv')).expect(200);
    const emails = await request(server).get('/api/support/emails').set(asCustomer('cust-priv')).expect(200);
    for (const body of [detail.body, list.body, notifications.body, emails.body]) {
      const text = JSON.stringify(body);
      for (const secret of secrets) expect(text).not.toContain(secret);
    }
    expect(detail.body.messages.map((m: { authorType: string }) => m.authorType)).toEqual(['customer', 'staff']);
    // Another customer still gets nothing (RULE-SUP-01), and the staff view keeps the restricted material for the team.
    await request(server).get(`/api/support/cases/${id}`).set(asCustomer('cust-other')).expect(404);
    const staffView = await request(server).get(`/api/staff/cases/${id}`).set(asStaff('staff-bruno', 'Bruno')).expect(200);
    expect(JSON.stringify(staffView.body)).toContain('NOTA-SIGILOSA');
  });

  it('PH-7.2: the role model is enforced — a non-owner agent gets 403 on state changes, a supervisor may, an unknown staff id is nobody, the directory role wins', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-role')).send({ category: 'other', message: 'Preciso de ajuda com papéis.' }).expect(201);
    const id = created.body.id;
    await request(server).post(`/api/staff/cases/${id}/messages`).set(asStaff('staff-ana', 'Ana')).send({ body: 'Olá' }).expect(201); // Ana is responsible
    const bruno = asStaff('staff-bruno', 'Bruno');
    await request(server).post(`/api/staff/cases/${id}/status`).set(bruno).send({ status: 'waiting_customer' }).expect(403);
    await request(server).post(`/api/staff/cases/${id}/resolve`).set(bruno).send({ reason: 'solved', explanation: 'ok' }).expect(403);
    await request(server).patch(`/api/staff/cases/${id}`).set(bruno).send({ priority: 'high' }).expect(403);
    await request(server).post(`/api/staff/cases/${id}/consultations`).set(bruno).send({ team: 'finance', question: 'Pode?' }).expect(403);
    await request(server).post(`/api/staff/cases/${id}/messages`).set(bruno).send({ body: 'Posso ajudar também.' }).expect(201);
    const afterReply = await request(server).get(`/api/staff/cases/${id}`).set(bruno).expect(200);
    expect(afterReply.body.assignedAgentId).toBe('staff-ana');
    // A header role cannot promote an agent: the directory says Bruno is an agent.
    await request(server).post(`/api/staff/cases/${id}/status`).set({ ...bruno, [SIMULATED_IDENTITY_HEADERS.staffRole]: 'supervisor' }).send({ status: 'waiting_customer' }).expect(403);
    const supervisor = { ...asStaff('staff-carla', 'Carla'), [SIMULATED_IDENTITY_HEADERS.staffRole]: 'supervisor' };
    await request(server).post(`/api/staff/cases/${id}/status`).set(supervisor).send({ status: 'waiting_customer' }).expect(200);
    // Unknown staff ids are nobody on every staff route.
    await request(server).get('/api/staff/cases?view=active').set(asStaff('staff-zzz', 'Zed')).expect(401);
    await request(server).get('/api/identity/me').set(asStaff('staff-zzz', 'Zed')).expect(401);
  });

  it('PH-7.1: the recovery route needs no identity, reveals nothing, retries safely, bounds abuse, and staff handle it attributably', async () => {
    const server = app.getHttpServer();
    const body = { contact: 'alice@example.com', description: 'Não consigo entrar: o código nunca chega.', clientRequestId: 'rec-e2e-1' };
    const receipt = await request(server).post('/api/public/access-recovery').send(body).expect(201);
    expect(receipt.body).toEqual({ reference: expect.stringMatching(/^REC-\d{6}$/), receivedAt: expect.any(String), nextStep: 'orbit_verification', delivery: 'simulated' });
    // A retry with the same client id answers with the same reference; a known customer's e-mail and an unknown one get the same shape.
    const again = await request(server).post('/api/public/access-recovery').send(body).expect(201);
    expect(again.body.reference).toBe(receipt.body.reference);
    const unknown = await request(server).post('/api/public/access-recovery').send({ contact: 'nobody@example.org', description: 'Também não consigo acessar minha conta.' }).expect(201);
    expect(Object.keys(unknown.body).sort()).toEqual(Object.keys(receipt.body).sort());
    // Identity headers are ignored, never required; invalid input is refused.
    await request(server).post('/api/public/access-recovery').set(asStaff('staff-ana', 'Ana')).send({ contact: 'x@example.com', description: 'Mensagem de teste com identidade.' }).expect(201);
    await request(server).post('/api/public/access-recovery').send({ contact: 'alice', description: 'Contato inválido nesta mensagem.' }).expect(400);
    await request(server).post('/api/public/access-recovery').send({ contact: 'a@b.co', description: 'NUL aqui \u0000 na descrição.' }).expect(400);
    // Abuse limit per contact per hour.
    await request(server).post('/api/public/access-recovery').send({ contact: 'flood@example.com', description: 'Primeira tentativa de flood.' }).expect(201);
    await request(server).post('/api/public/access-recovery').send({ contact: 'flood@example.com', description: 'Segunda tentativa de flood.' }).expect(201);
    await request(server).post('/api/public/access-recovery').send({ contact: 'FLOOD@example.com', description: 'Terceira tentativa de flood.' }).expect(201);
    const limited = await request(server).post('/api/public/access-recovery').send({ contact: 'flood@example.com', description: 'Quarta tentativa de flood.' }).expect(429);
    expect(limited.body).toMatchObject({ error: 'too_many_requests', retryAfterSeconds: expect.any(Number) });
    // Staff only for the list and the outcome; customers and anonymous callers are refused.
    await request(server).get('/api/staff/access-recovery').expect(401);
    await request(server).get('/api/staff/access-recovery').set(asCustomer('cust-alice')).expect(403);
    const list = await request(server).get('/api/staff/access-recovery?status=received').set(asStaff('staff-ana', 'Ana')).expect(200);
    const mine = list.body.find((r: { reference: string }) => r.reference === receipt.body.reference);
    expect(mine).toMatchObject({ contact: 'alice@example.com', status: 'received' });
    expect(JSON.stringify(list.body)).not.toContain('customerId');
    const handled = await request(server).post(`/api/staff/access-recovery/${mine.id}/handle`).set(asStaff('staff-ana', 'Ana')).send({ outcome: 'forwarded', note: 'Encaminhado.' }).expect(200);
    expect(handled.body).toMatchObject({ status: 'forwarded', handledById: 'staff-ana', handledByName: 'Ana' });
    await request(server).post(`/api/staff/access-recovery/${mine.id}/handle`).set(asStaff('staff-ana', 'Ana')).send({ outcome: 'closed' }).expect(409);
    await request(server).get('/api/staff/access-recovery?status=bogus').set(asStaff('staff-ana', 'Ana')).expect(400);
  });

  it('PH-6.3: a message outside the configured hours gets an honest system notice; settings validate the reminder delay', async () => {
    const server = app.getHttpServer();
    const supervisor = { ...asStaff('staff-carla', 'Carla'), [SIMULATED_IDENTITY_HEADERS.staffRole]: 'supervisor' };
    const current = (await request(server).get('/api/staff/settings').set(supervisor).expect(200)).body;
    const allClosed = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    await request(server).put('/api/staff/settings').set(supervisor).send({ ...current, reminderAfterHours: 0 }).expect(400);
    // FND-0030 / FND-0048: an unknown zone or a coerced boolean is refused, and availability keeps answering.
    const badZone = await request(server).put('/api/staff/settings').set(supervisor).send({ ...current, timezone: 'Mars/Olympus' }).expect(400);
    expect(badZone.body.issues.map((i: { path: string }) => i.path)).toEqual(['timezone']);
    await request(server).put('/api/staff/settings').set(supervisor).send({ ...current, attentionThresholdHours: true }).expect(400);
    await request(server).get('/api/support/availability').set(asCustomer('cust-alice')).expect(200);
    await request(server).put('/api/staff/settings').set(supervisor).send({ ...current, schedule: allClosed }).expect(200);
    try {
      const created = await request(server).post('/api/support/cases').set(asCustomer('cust-night')).send({ category: 'other', message: 'Boa noite' }).expect(201);
      const detail = await request(server).get(`/api/support/cases/${created.body.id}`).set(asCustomer('cust-night')).expect(200);
      const notice = detail.body.messages.find((m: { authorType: string }) => m.authorType === 'system');
      expect(notice.body).toContain('Fora do horário de atendimento');
      const notifications = await request(server).get('/api/support/notifications').set(asCustomer('cust-night')).expect(200);
      expect(notifications.body.notifications.map((n: { kind: string }) => n.kind)).toEqual(['outside_hours']);
    } finally {
      await request(server).put('/api/staff/settings').set(supervisor).send(current).expect(200);
    }
  });

});
