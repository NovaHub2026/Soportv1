import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ATTACHMENT_LIMITS, SIMULATED_IDENTITY_HEADERS } from '@orbit-support/shared';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

const asCustomer = (id: string) => ({ [SIMULATED_IDENTITY_HEADERS.customerId]: id });
const asStaff = (id: string, name = id) => ({
  [SIMULATED_IDENTITY_HEADERS.staffId]: id,
  [SIMULATED_IDENTITY_HEADERS.staffName]: name,
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake png payload for tests')]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF');
const EXE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 not an image');

describe('Attachments (e2e)', () => {
  let app: INestApplication;
  let caseId: string;

  beforeAll(async () => {
    delete process.env.SUPPORT_DB_DIR;
    process.env.SUPPORT_UPLOADS_DIR = mkdtempSync(join(tmpdir(), 'orbit-uploads-'));
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleFixture.createNestApplication());
    await app.init();
    const created = await request(app.getHttpServer())
      .post('/api/support/cases')
      .set(asCustomer('cust-alice'))
      .send({ category: 'deposits_withdrawals', message: 'Segue o comprovante' })
      .expect(201);
    caseId = created.body.id;
  });

  afterAll(async () => {
    delete process.env.SUPPORT_UPLOADS_DIR;
    await app.close();
  });

  it('accepts an allowed file (type decided by its bytes, not its name), links it to a message and serves it back', async () => {
    const server = app.getHttpServer();
    const uploaded = await request(server)
      .post(`/api/support/cases/${caseId}/attachments`)
      .set(asCustomer('cust-alice'))
      .attach('file', PNG, { filename: 'comprovante.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(uploaded.body).toMatchObject({ mimeType: 'image/png', fileName: 'comprovante.jpg', messageId: null, status: 'available', sizeBytes: PNG.length });

    const sent = await request(server)
      .post(`/api/support/cases/${caseId}/messages`)
      .set(asCustomer('cust-alice'))
      .send({ body: 'Aqui está', attachmentIds: [uploaded.body.id] })
      .expect(201);
    expect(sent.body.attachments).toHaveLength(1);
    expect(sent.body.attachments[0]).toMatchObject({ id: uploaded.body.id, messageId: sent.body.id });

    // Cannot be linked twice.
    await request(server)
      .post(`/api/support/cases/${caseId}/messages`)
      .set(asCustomer('cust-alice'))
      .send({ body: 'De novo', attachmentIds: [uploaded.body.id] })
      .expect(400);

    const detail = await request(server).get(`/api/support/cases/${caseId}`).set(asCustomer('cust-alice')).expect(200);
    const withFile = detail.body.messages.find((m: { id: string }) => m.id === sent.body.id);
    expect(withFile.attachments[0].fileName).toBe('comprovante.jpg');

    const download = await request(server)
      .get(`/api/support/cases/${caseId}/attachments/${uploaded.body.id}`)
      .set(asCustomer('cust-alice'))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(download.headers['content-type']).toBe('image/png');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['content-disposition']).toContain('inline');
    expect(Buffer.compare(download.body as Buffer, PNG)).toBe(0);

    // Staff can read it too; another customer cannot even learn it exists.
    await request(server).get(`/api/support/cases/${caseId}/attachments/${uploaded.body.id}`).set(asStaff('staff-ana', 'Ana')).expect(403);
    await request(server).get(`/api/staff/cases/${caseId}/attachments/${uploaded.body.id}`).set(asStaff('staff-ana', 'Ana')).expect(200);
    await request(server).get(`/api/support/cases/${caseId}/attachments/${uploaded.body.id}`).set(asCustomer('cust-bob')).expect(404);
  });

  it('staff uploads are linked to their reply and readable by the customer', async () => {
    const server = app.getHttpServer();
    const uploaded = await request(server)
      .post(`/api/staff/cases/${caseId}/attachments`)
      .set(asStaff('staff-ana', 'Ana'))
      .attach('file', PDF, { filename: 'orientações.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(uploaded.body.mimeType).toBe('application/pdf');

    // The customer cannot use a staff upload as their own attachment.
    await request(server)
      .post(`/api/support/cases/${caseId}/messages`)
      .set(asCustomer('cust-alice'))
      .send({ body: 'Tentando anexar o arquivo da Ana', attachmentIds: [uploaded.body.id] })
      .expect(400);
    // And cannot download it while it is still unattached.
    await request(server).get(`/api/support/cases/${caseId}/attachments/${uploaded.body.id}`).set(asCustomer('cust-alice')).expect(404);

    await request(server)
      .post(`/api/staff/cases/${caseId}/messages`)
      .set(asStaff('staff-ana', 'Ana'))
      .send({ body: 'Veja as orientações em anexo.', attachmentIds: [uploaded.body.id] })
      .expect(201);
    const download = await request(server).get(`/api/support/cases/${caseId}/attachments/${uploaded.body.id}`).set(asCustomer('cust-alice')).expect(200);
    expect(download.headers['content-type']).toBe('application/pdf');
  });

  it('refuses executables disguised as images (415), oversized files (413), missing files (400) and too many ids (400)', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post(`/api/support/cases/${caseId}/attachments`)
      .set(asCustomer('cust-alice'))
      .attach('file', EXE, { filename: 'foto.png', contentType: 'image/png' })
      .expect(415);
    await request(server)
      .post(`/api/support/cases/${caseId}/attachments`)
      .set(asCustomer('cust-alice'))
      .attach('file', Buffer.concat([PNG, Buffer.alloc(ATTACHMENT_LIMITS.maxBytes)]), { filename: 'grande.png', contentType: 'image/png' })
      .expect(413);
    await request(server).post(`/api/support/cases/${caseId}/attachments`).set(asCustomer('cust-alice')).expect(400);
    const ids = Array.from({ length: ATTACHMENT_LIMITS.maxPerMessage + 1 }, () => '11111111-1111-4111-8111-111111111111');
    await request(server)
      .post(`/api/support/cases/${caseId}/messages`)
      .set(asCustomer('cust-alice'))
      .send({ body: 'muitos', attachmentIds: ids })
      .expect(400);
    await request(server).post(`/api/support/cases/${caseId}/attachments`).set(asCustomer('cust-bob')).attach('file', PNG, 'x.png').expect(404);
  });

  it('Cycle Audit 1: a file of exactly the maximum size is accepted, accents in names survive, closed cases take no files', async () => {
    const server = app.getHttpServer();
    const exact = Buffer.concat([PNG, Buffer.alloc(ATTACHMENT_LIMITS.maxBytes - PNG.length)]);
    const ok = await request(server)
      .post(`/api/support/cases/${caseId}/attachments`)
      .set(asCustomer('cust-alice'))
      .attach('file', exact, { filename: 'comprovante-março.png', contentType: 'image/png' })
      .expect(201);
    expect(ok.body).toMatchObject({ sizeBytes: ATTACHMENT_LIMITS.maxBytes, fileName: 'comprovante-março.png' });
    await request(server)
      .post(`/api/support/cases/${caseId}/attachments`)
      .set(asCustomer('cust-alice'))
      .attach('file', Buffer.concat([exact, Buffer.from([0])]), { filename: 'x.png', contentType: 'image/png' })
      .expect(413);

    const closed = await request(server).post('/api/support/cases').set(asCustomer('cust-alice')).send({ category: 'other', message: 'Encerrado' }).expect(201);
    await request(server).post(`/api/staff/cases/${closed.body.id}/resolve`).set(asStaff('staff-ana', 'Ana')).send({ reason: 'solved', explanation: 'ok' }).expect(200);
    await request(server).post(`/api/staff/cases/${closed.body.id}/close`).set(asStaff('staff-ana', 'Ana')).expect(200);
    await request(server).post(`/api/support/cases/${closed.body.id}/attachments`).set(asCustomer('cust-alice')).attach('file', PNG, 'x.png').expect(409);
  });

  it('PH-9.3: a customer attaches files before the case exists; the creation links them to the first message; nobody else can use them (BL-010)', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/support/attachments').set(asStaff('staff-ana', 'Ana')).attach('file', PNG, 'x.png').expect(403);
    await request(server).post('/api/support/attachments').set(asCustomer('cust-stage')).attach('file', EXE, 'foto.png').expect(415);
    const staged = await request(server).post('/api/support/attachments').set(asCustomer('cust-stage')).attach('file', PNG, 'comprovante.png').expect(201);
    expect(staged.body).toMatchObject({ caseId: null, messageId: null, fileName: 'comprovante.png', mimeType: 'image/png' });
    // Another customer cannot link it, and the refused creation leaves no case behind.
    await request(server).post('/api/support/cases').set(asCustomer('cust-other')).send({ category: 'other', message: 'Pego o arquivo?', attachmentIds: [staged.body.id] }).expect(400);
    await request(server).get('/api/support/cases').set(asCustomer('cust-other')).expect(200, []);
    const body = { category: 'deposits_withdrawals', message: 'Segue o comprovante do depósito', attachmentIds: [staged.body.id], clientMessageId: 'stage-1' };
    const created = await request(server).post('/api/support/cases').set(asCustomer('cust-stage')).send(body).expect(201);
    expect(created.body.messages[0].attachments).toEqual([expect.objectContaining({ id: staged.body.id, caseId: created.body.id, messageId: created.body.messages[0].id })]);
    const retry = await request(server).post('/api/support/cases').set(asCustomer('cust-stage')).send(body).expect(201);
    expect(retry.body.id).toBe(created.body.id); // a retried creation returns the same case
    const file = await request(server).get(`/api/support/cases/${created.body.id}/attachments/${staged.body.id}`).set(asCustomer('cust-stage')).expect(200);
    expect(file.headers['content-type']).toBe('image/png');
    const staffView = await request(server).get(`/api/staff/cases/${created.body.id}`).set(asStaff('staff-ana', 'Ana')).expect(200);
    expect(staffView.body.messages[0].attachments[0].id).toBe(staged.body.id);
    // Already linked: it cannot open a second case.
    await request(server).post('/api/support/cases').set(asCustomer('cust-stage')).send({ category: 'other', message: 'De novo', attachmentIds: [staged.body.id] }).expect(400);
  });
});
