import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { type CaseMessage, SIMULATED_IDENTITY_HEADERS, STAFF_ONLY_SUMMARY_FIELDS, type StreamEvent } from '@orbit-support/shared';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DB } from './../src/database/database.module.js';
import type { Db } from './../src/database/database.js';
import { supportCases } from './../src/database/schema.js';
import { CaseEventBus } from './../src/events/case-event-bus.js';

const asCustomer = (id: string) => ({ [SIMULATED_IDENTITY_HEADERS.customerId]: id });
const asStaff = (id: string, name = id) => ({
  [SIMULATED_IDENTITY_HEADERS.staffId]: id,
  [SIMULATED_IDENTITY_HEADERS.staffName]: name,
});

/** Reads a live SSE response in the background and lets tests wait for matching events. */
function collect(response: Response) {
  const events: Array<{ type: string; data: StreamEvent }> = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let type = 'message';
  let data: string[] = [];
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl = buffer.indexOf('\n');
        while (nl !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line === '') {
            if (data.length) events.push({ type, data: JSON.parse(data.join('\n')) as StreamEvent });
            type = 'message';
            data = [];
          } else if (line.startsWith('event:')) type = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
          nl = buffer.indexOf('\n');
        }
      }
    } catch {
      // aborted by the test
    }
  })();
  return {
    events,
    async waitFor(predicate: (e: { type: string; data: StreamEvent }) => boolean, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const found = events.find(predicate);
        if (found) return found;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error(`No event matched within ${timeoutMs} ms; got ${JSON.stringify(events.map((e) => e.type))}`);
    },
  };
}

describe('Live streams (SSE, e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let base: string;
  const controllers: AbortController[] = [];

  const open = async (path: string, headers: Record<string, string>) => {
    const controller = new AbortController();
    controllers.push(controller);
    const response = await fetch(`${base}${path}`, { headers: { accept: 'text/event-stream', ...headers }, signal: controller.signal });
    return response;
  };

  beforeAll(async () => {
    delete process.env.SUPPORT_DB_DIR;
    process.env.SUPPORT_SSE_HEARTBEAT_MS = '300';
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.listen(0, '127.0.0.1');
    await app.get<Db>(DB).delete(supportCases); // PH-8.2: a shared PostgreSQL database must start empty for this file
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const c of controllers) c.abort();
    delete process.env.SUPPORT_SSE_HEARTBEAT_MS;
    await app.close();
  });

  it('delivers a staff reply to the customer stream and sends heartbeats, but never an internal note (RULE-SUP-04)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-alice'))
      .send({ category: 'operations', message: 'Ao vivo?' })
      .expect(201);
    const caseId: string = created.body.id;

    const response = await open(`/api/support/cases/${caseId}/stream`, asCustomer('cust-alice'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const stream = collect(response);

    await stream.waitFor((e) => e.type === 'heartbeat', 2000);

    await request(app.getHttpServer())
      .post(`/api/staff/cases/${caseId}/messages`)
      .set(asStaff('staff-ana', 'Ana'))
      .send({ body: 'Sim, ao vivo.' })
      .expect(201);
    const delivered = await stream.waitFor((e) => e.type === 'message.created');
    if (delivered.data.type !== 'message.created') throw new Error('unexpected');
    expect(delivered.data.message).toMatchObject({ authorType: 'staff', body: 'Sim, ao vivo.', visibility: 'public' });
    await stream.waitFor((e) => e.type === 'case.updated');

    // An internal note published on the bus must not reach the customer; a public marker after it must.
    const bus = moduleRef.get(CaseEventBus);
    const internal: CaseMessage = {
      id: '00000000-0000-4000-8000-000000000001',
      caseId,
      authorType: 'staff',
      authorId: 'staff-ana',
      authorName: 'Ana',
      visibility: 'internal',
      body: 'NOTA INTERNA: verificar com Finance',
      clientMessageId: null,
      createdAt: new Date().toISOString(),
      attachments: [],
    };
    const before = stream.events.length;
    bus.publish({ type: 'message.created', caseId, customerId: 'cust-alice', message: internal, at: new Date().toISOString() });
    bus.publish({ type: 'case.updated', caseId, customerId: 'cust-alice', summary: created.body, at: new Date().toISOString() });
    await stream.waitFor((e, index = stream.events.indexOf(e)) => index >= before && e.type === 'case.updated');
    const leaked = stream.events.some((e) => e.type === 'message.created' && e.data.type === 'message.created' && e.data.message.visibility === 'internal');
    expect(leaked).toBe(false);
  });

  it('refuses the stream of another customer’s case before sending any event (404) and without identity (401)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-alice'))
      .send({ category: 'other', message: 'Privado' })
      .expect(201);
    const other = await open(`/api/support/cases/${created.body.id}/stream`, asCustomer('cust-bob'));
    expect(other.status).toBe(404);
    const anonymous = await open(`/api/support/cases/${created.body.id}/stream`, {});
    expect(anonymous.status).toBe(401);
    await request(app.getHttpServer()).get('/api/staff/cases/stream').set(asCustomer('cust-alice')).expect(403);
  });

  it('the customer-wide stream carries changes on any own case (public only) and nothing from other customers', async () => {
    const response = await open('/api/support/cases/stream', asCustomer('cust-dora'));
    expect(response.status).toBe(200);
    const stream = collect(response);

    const mine = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-dora'))
      .send({ category: 'other', message: 'Meu caso' })
      .expect(201);
    await stream.waitFor((e) => e.type === 'case.updated' && e.data.type === 'case.updated' && e.data.caseId === mine.body.id);

    await request(app.getHttpServer())
      .post(`/api/staff/cases/${mine.body.id}/messages`)
      .set(asStaff('staff-ana', 'Ana'))
      .send({ body: 'Resposta' })
      .expect(201);
    await stream.waitFor((e) => e.type === 'message.created' && e.data.type === 'message.created' && e.data.message.body === 'Resposta');

    const before = stream.events.length;
    const theirs = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-eve'))
      .send({ category: 'other', message: 'Caso de outra pessoa' })
      .expect(201);
    // Publish a marker for Dora after Eve's events to know they had the chance to arrive.
    moduleRef.get(CaseEventBus).publish({ type: 'case.updated', caseId: mine.body.id, customerId: 'cust-dora', summary: mine.body, at: new Date().toISOString() });
    await stream.waitFor((e, index = stream.events.indexOf(e)) => index >= before && e.type === 'case.updated' && e.data.type === 'case.updated' && e.data.caseId === mine.body.id);
    expect(stream.events.some((e) => e.data.type !== 'heartbeat' && e.data.caseId === theirs.body.id)).toBe(false);
  });

  it('the staff stream carries every case change, including internal notes', async () => {
    const response = await open('/api/staff/cases/stream', asStaff('staff-ana', 'Ana'));
    expect(response.status).toBe(200);
    const stream = collect(response);

    const created = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-carla'))
      .send({ category: 'other', message: 'Novo caso' })
      .expect(201);
    const seen = await stream.waitFor((e) => e.type === 'case.updated' && e.data.type === 'case.updated' && e.data.caseId === created.body.id);
    if (seen.data.type !== 'case.updated') throw new Error('unexpected');
    expect(seen.data.summary.reference).toBe(created.body.reference);

    moduleRef.get(CaseEventBus).publish({
      type: 'message.created',
      caseId: created.body.id,
      customerId: 'cust-carla',
      message: {
        id: '00000000-0000-4000-8000-000000000002',
        caseId: created.body.id,
        authorType: 'staff',
        authorId: 'staff-bruno',
        authorName: 'Bruno',
        visibility: 'internal',
        body: 'nota',
        clientMessageId: null,
        createdAt: new Date().toISOString(),
        attachments: [],
      },
      at: new Date().toISOString(),
    });
    const note = await stream.waitFor((e) => e.type === 'message.created' && e.data.type === 'message.created' && e.data.message.visibility === 'internal');
    expect(note).toBeDefined();
  });

  it('customer streams carry the customer projection: no incident, priority or staff-only fields (FND-0006)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-fabio'))
      .send({ category: 'other', message: 'Projeção' })
      .expect(201);
    const own = collect(await open(`/api/support/cases/${created.body.id}/stream`, asCustomer('cust-fabio')));
    const all = collect(await open('/api/support/cases/stream', asCustomer('cust-fabio')));

    const incident = await request(app.getHttpServer()).post('/api/staff/incidents').set(asStaff('staff-ana', 'Ana')).send({ title: 'INTERNO: Pix fora' }).expect(201);
    await request(app.getHttpServer()).post(`/api/staff/cases/${created.body.id}/incident`).set(asStaff('staff-ana', 'Ana')).send({ incidentId: incident.body.id }).expect(200);

    for (const stream of [own, all]) {
      const updated = await stream.waitFor((e) => e.type === 'case.updated' && e.data.type === 'case.updated' && e.data.caseId === created.body.id);
      if (updated.data.type !== 'case.updated') throw new Error('unexpected');
      for (const field of STAFF_ONLY_SUMMARY_FIELDS) expect(updated.data.summary).not.toHaveProperty(field);
      expect(updated.data.summary.reference).toBe(created.body.reference);
      expect(JSON.stringify(updated.data)).not.toContain('Pix fora');
    }
  });

});
