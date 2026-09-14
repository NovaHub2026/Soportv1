import { vi } from 'vitest';
import { DataExportService } from './data-export.service.js';
import { ATTACHMENT_STORAGE, type AttachmentStorage } from '../attachments/storage.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { randomUUID } from 'node:crypto';
import { awaitingReplySince, awaitingReplySinceSql, waitingInternalSince, waitingInternalSinceSql } from './case-rules.js';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../database/database.js';
import { type CaseStreamEvent, STAFF_ONLY_SUMMARY_FIELDS } from '@orbit-support/shared';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { DatabaseModule, DB } from '../database/database.module.js';
import { caseConsultations, caseMessages, supportCases, caseAttachments, caseNotifications } from '../database/schema.js';
import { CaseEventBus } from '../events/case-event-bus.js';
import type { CustomerActor, StaffActor } from '../identity/identity.types.js';
import { ORBIT_RECORDS } from '../identity/orbit-records.js';
import { SimulatedOrbitRecords } from '../identity/simulated-orbit-records.js';
import { SimulatedStaffDirectory, STAFF_DIRECTORY } from '../identity/staff-directory.js';
import { CasesService } from './cases.service.js';
import { EMAIL_NOTIFIER, SimulatedEmailNotifier, type EmailNotifierPort } from './email-notifier.js';
import { NotificationJob } from './notification.job.js';
import { NotificationsService } from './notifications.service.js';
import { ReminderJob } from './reminder.job.js';
import { SettingsService } from './settings.service.js';
import { SupervisionService } from './supervision.service.js';

/** Mutable so a test can take the simulated Orbit down (FND-0032). */
const orbitEnv: NodeJS.ProcessEnv = {};
const alice: CustomerActor = { kind: 'customer', id: 'cust-alice', source: 'simulated' };
const bob: CustomerActor = { kind: 'customer', id: 'cust-bob', source: 'simulated' };
const ana: StaffActor = { kind: 'staff', id: 'staff-ana', role: 'agent', displayName: 'Ana', source: 'simulated' };
const bruno: StaffActor = { kind: 'staff', id: 'staff-bruno', role: 'agent', displayName: 'Bruno', source: 'simulated' };
const carla: StaffActor = { kind: 'staff', id: 'staff-carla', role: 'supervisor', displayName: 'Carla', source: 'simulated' };

describe('CasesService (embedded PostgreSQL, in memory)', () => {
  let moduleRef: TestingModule;
  let service: CasesService;
  let db: Db;
  let published: CaseStreamEvent[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule.forRoot({ inMemory: true }), AttachmentsModule.forRoot({ inMemory: true })],
      providers: [
        CasesService,
        CaseEventBus,
        { provide: STAFF_DIRECTORY, useClass: SimulatedStaffDirectory },
        { provide: ORBIT_RECORDS, useValue: new SimulatedOrbitRecords(orbitEnv) },
        SettingsService,
        SupervisionService,
        NotificationsService,
        NotificationJob,
        ReminderJob,
        DataExportService,
        { provide: EMAIL_NOTIFIER, useClass: SimulatedEmailNotifier },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(CasesService);
    db = moduleRef.get(DB);
    moduleRef.get(CaseEventBus).events$.subscribe((event) => published.push(event));
    // PH-6.3: the outside-hours notice depends on the wall clock; keep the schedule open so every test is deterministic.
    const settings = moduleRef.get(SettingsService);
    await settings.update(carla, { ...(await settings.get()), schedule: { mon: { open: '00:00', close: '24:00' }, tue: { open: '00:00', close: '24:00' }, wed: { open: '00:00', close: '24:00' }, thu: { open: '00:00', close: '24:00' }, fri: { open: '00:00', close: '24:00' }, sat: { open: '00:00', close: '24:00' }, sun: { open: '00:00', close: '24:00' } } });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await db.delete(supportCases);
    published = [];
  });

  describe('lifecycle: status transitions and resolution (PH-3.1)', () => {
    it('staff set what the case is waiting for, taking responsibility for an unowned case, with attributable events', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Preciso de ajuda' });
      const waiting = await service.setStatus(ana, created.id, 'waiting_customer');
      expect(waiting).toMatchObject({ status: 'waiting_customer', assignedAgentId: ana.id });

      // The customer's reply returns the case to active attention (§7.2).
      await service.postCustomerMessage(alice, created.id, { body: 'Segue a informação' });
      expect((await service.getStaffCase(created.id)).status).toBe('in_progress');

      const internal = await service.setStatus(ana, created.id, 'waiting_internal');
      expect(internal.status).toBe('waiting_internal');
      // A customer reply while waiting for an internal team keeps the dependency (§7.2).
      await service.postCustomerMessage(alice, created.id, { body: 'Alguma novidade?' });
      expect((await service.getStaffCase(created.id)).status).toBe('waiting_internal');

      const resumed = await service.setStatus(ana, created.id, 'in_progress');
      expect(resumed.status).toBe('in_progress');
      const types = (await service.getStaffCase(created.id)).events.map((e) => e.type);
      expect(types.filter((t) => t === 'status_changed').length).toBeGreaterThanOrEqual(4);
    });

    it('resolves with a reason and a customer-facing explanation; a customer reply reactivates and clears the reason', async () => {
      const created = await service.createCase(alice, { category: 'deposits_withdrawals', message: 'Saque atrasado' });
      const resolved = await service.resolve(ana, created.id, { reason: 'solved', explanation: 'Seu saque foi confirmado na rede às 14:02.' });
      expect(resolved).toMatchObject({ status: 'resolved', resolutionReason: 'solved', assignedAgentId: ana.id });
      expect(resolved.resolvedAt).not.toBeNull();

      const customerView = await service.getCustomerCase(alice, created.id);
      expect(customerView.messages.at(-1)).toMatchObject({ authorType: 'staff', visibility: 'public', body: 'Seu saque foi confirmado na rede às 14:02.' });
      const events = (await service.getStaffCase(created.id)).events;
      expect(events.at(-1)).toMatchObject({ type: 'case_resolved', actorId: ana.id, data: { reason: 'solved' } });

      await expect(service.resolve(ana, created.id, { reason: 'solved', explanation: 'de novo' })).rejects.toBeInstanceOf(ConflictException);

      await service.postCustomerMessage(alice, created.id, { body: 'Ainda preciso de ajuda.' });
      const reopened = await service.getStaffCase(created.id);
      expect(reopened).toMatchObject({ status: 'in_progress', resolvedAt: null, resolutionReason: null });
    });

    it('refuses transitions on a closed case', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await db.update(supportCases).set({ status: 'closed', closedAt: new Date() }).where(eq(supportCases.id, created.id));
      await expect(service.setStatus(ana, created.id, 'in_progress')).rejects.toBeInstanceOf(ConflictException);
      await expect(service.resolve(ana, created.id, { reason: 'solved', explanation: 'x' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('shared incidents (PH-3.5, §5.4)', () => {
    it('links cases to an open incident, broadcasts internal notes to linked open cases only, and resolving the incident leaves case statuses alone', async () => {
      const a = await service.createCase(alice, { category: 'deposits_withdrawals', message: 'Pix não caiu' });
      const b = await service.createCase(bob, { category: 'deposits_withdrawals', message: 'Depósito sumiu' });
      const unrelated = await service.createCase(alice, { category: 'other', message: 'Outra coisa' });

      const incident = await service.createIncident(ana, { title: 'Atraso no provedor Pix', description: 'Desde 10:00' });
      expect(incident).toMatchObject({ status: 'open', linkedCaseCount: 0, createdByName: 'Ana' });

      const linkedA = await service.linkIncident(ana, a.id, incident.id);
      await service.linkIncident(ana, b.id, incident.id);
      expect(linkedA).toMatchObject({ incidentId: incident.id, incidentTitle: 'Atraso no provedor Pix' });
      expect((await service.listIncidents('open'))[0].linkedCaseCount).toBe(2);
      expect((await service.getStaffCase(a.id)).events.at(-1)).toMatchObject({ type: 'incident_linked', data: { incidentId: incident.id, title: 'Atraso no provedor Pix' } });

      const { delivered } = await service.broadcastIncidentNote(ana, incident.id, { body: 'Provedor confirmou normalização às 11:20.' });
      expect(delivered).toBe(2);
      const noteOnA = (await service.getStaffCase(a.id)).messages.at(-1);
      expect(noteOnA).toMatchObject({ visibility: 'internal', authorId: ana.id });
      expect(noteOnA?.body).toContain('normalização');
      expect((await service.getCustomerCase(alice, a.id)).messages.some((m) => m.body.includes('normalização'))).toBe(false);
      expect((await service.getStaffCase(unrelated.id)).messages).toHaveLength(1);

      const resolved = await service.resolveIncident(ana, incident.id);
      expect(resolved.status).toBe('resolved');
      expect((await service.getStaffCase(a.id)).status).toBe('new'); // untouched
      expect((await service.getStaffCase(a.id)).messages.at(-1)?.body).toContain('marcado como resolvido');
      await expect(service.resolveIncident(ana, incident.id)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.linkIncident(ana, unrelated.id, incident.id)).rejects.toBeInstanceOf(ConflictException); // resolved incident

      const unlinked = await service.linkIncident(ana, b.id, null);
      expect(unlinked.incidentId).toBeNull();
      await expect(service.linkIncident(ana, b.id, '00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('closure and linked follow-up (PH-3.4, RULE-SUP-06)', () => {
    it('only resolved cases close; the job closes those past the window and leaves recent ones; staff can close explicitly', async () => {
      const recent = await service.createCase(alice, { category: 'other', message: 'Recente' });
      const old = await service.createCase(alice, { category: 'other', message: 'Antigo' });
      const open = await service.createCase(alice, { category: 'other', message: 'Aberto' });
      await service.resolve(ana, recent.id, { reason: 'solved', explanation: 'ok' });
      await service.resolve(ana, old.id, { reason: 'solved', explanation: 'ok' });
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await db.update(supportCases).set({ resolvedAt: eightDaysAgo }).where(eq(supportCases.id, old.id));

      expect(await service.closeExpired(new Date(), 7)).toBe(1);
      expect(await service.closeExpired(new Date(), 7)).toBe(0); // idempotent
      const closedOld = await service.getStaffCase(old.id);
      expect(closedOld).toMatchObject({ status: 'closed' });
      expect(closedOld.closedAt).not.toBeNull();
      expect(closedOld.events.at(-1)).toMatchObject({ type: 'case_closed', actorType: 'system', data: { reason: 'auto_window' } });
      expect((await service.getStaffCase(recent.id)).status).toBe('resolved');
      expect((await service.getStaffCase(open.id)).status).toBe('new');

      await expect(service.closeCase(ana, open.id)).rejects.toBeInstanceOf(ConflictException);
      const closedByStaff = await service.closeCase(ana, recent.id);
      expect(closedByStaff.status).toBe('closed');
      expect((await service.getStaffCase(recent.id)).events.at(-1)).toMatchObject({ type: 'case_closed', actorId: ana.id, data: { reason: 'staff' } });
    });

    it('a follow-up from a closed case is a new linked case with the previous reference; other states and customers are refused', async () => {
      const parent = await service.createCase(alice, { category: 'deposits_withdrawals', message: 'Saque' });
      await expect(service.createFollowUp(alice, parent.id, { message: 'Ainda não' })).rejects.toBeInstanceOf(ConflictException);
      await service.resolve(ana, parent.id, { reason: 'solved', explanation: 'ok' });
      await service.closeCase(ana, parent.id);

      await expect(service.createFollowUp(bob, parent.id, { message: 'Não é meu' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.postCustomerMessage(alice, parent.id, { body: 'Oi?' })).rejects.toBeInstanceOf(ConflictException);

      const child = await service.createFollowUp(alice, parent.id, { message: 'O saque voltou a atrasar.', clientMessageId: 'fu-1' });
      expect(child).toMatchObject({ status: 'new', category: 'deposits_withdrawals', parentCaseId: parent.id, parentReference: parent.reference });
      expect(child.reference).not.toBe(parent.reference);
      expect(child.messages.map((m) => m.authorType)).toEqual(['system', 'customer']);
      expect(child.messages[0].body).toContain(parent.reference);

      const again = await service.createFollowUp(alice, parent.id, { message: 'O saque voltou a atrasar.', clientMessageId: 'fu-1' });
      expect(again.id).toBe(child.id);

      const parentView = await service.getStaffCase(parent.id);
      expect(parentView.events.at(-1)).toMatchObject({ type: 'follow_up_created', data: { followUpCaseId: child.id, followUpReference: child.reference } });
      expect((await service.listCustomerCases(alice)).map((c) => c.parentReference)).toContain(parent.reference);
      expect((await service.listStaffCases(ana, 'unassigned'))[0].parentReference).toBe(parent.reference);
    });
  });

  describe('assignment and attributes (PH-3.3, RULE-SUP-02, RULE-SUP-09)', () => {
    it('the owner transfers with history preserved; another agent cannot; a supervisor can; release returns the case to the queue', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await service.takeCase(ana, created.id);
      await service.requestConsultation(ana, created.id, { team: 'finance', question: 'Pendente?' });

      await expect(service.assignCase(bruno, created.id, { agentId: bruno.id })).rejects.toBeInstanceOf(ForbiddenException);

      const transferred = await service.assignCase(ana, created.id, { agentId: bruno.id });
      expect(transferred.assignedAgentId).toBe(bruno.id);
      const view = await service.getStaffCase(created.id);
      expect(view.consultations).toHaveLength(1); // nothing lost
      expect(view.status).toBe('waiting_internal');
      expect(view.events.at(-1)).toMatchObject({ type: 'case_assigned', actorId: ana.id, data: { agentId: bruno.id, previousAgentId: ana.id } });
      expect((await service.listStaffCases(bruno, 'mine')).map((c) => c.id)).toEqual([created.id]);

      const reassigned = await service.assignCase(carla, created.id, { agentId: ana.id }); // supervisor
      expect(reassigned.assignedAgentId).toBe(ana.id);

      const released = await service.assignCase(ana, created.id, { agentId: null });
      expect(released.assignedAgentId).toBeNull();
      expect((await service.listStaffCases(bruno, 'unassigned')).map((c) => c.id)).toEqual([created.id]);
      const last = (await service.getStaffCase(created.id)).events.at(-1);
      expect(last).toMatchObject({ type: 'case_assigned', data: { agentId: null, released: true, previousAgentId: ana.id } });
    });

    it('priority and category corrections record from → to events; closed cases refuse both', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Conta bloqueada' });
      const updated = await service.updateAttributes(ana, created.id, { priority: 'urgent', category: 'account_verification' });
      expect(updated).toMatchObject({ priority: 'urgent', category: 'account_verification' });
      const events = (await service.getStaffCase(created.id)).events;
      expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['priority_changed', 'category_changed']));
      expect(events.find((e) => e.type === 'priority_changed')?.data).toEqual({ from: 'normal', to: 'urgent' });

      await db.update(supportCases).set({ status: 'closed', closedAt: new Date() }).where(eq(supportCases.id, created.id));
      await expect(service.updateAttributes(ana, created.id, { priority: 'low' })).rejects.toBeInstanceOf(ConflictException);
      await expect(service.assignCase(carla, created.id, { agentId: bruno.id })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('internal notes and consultations (PH-3.2, RULE-SUP-04)', () => {
    it('an internal note is visible to staff only and never counts as unread for the customer', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const note = await service.postInternalNote(ana, created.id, { body: 'Verificar com Finance antes de responder.' });
      expect(note.visibility).toBe('internal');

      const customerView = await service.getCustomerCase(alice, created.id);
      expect(customerView.messages.some((m) => m.body.includes('Finance'))).toBe(false);
      expect((await service.listCustomerCases(alice))[0].unreadCount).toBe(0);
      const staffView = await service.getStaffCase(created.id);
      expect(staffView.messages.at(-1)).toMatchObject({ visibility: 'internal', authorName: 'Ana' });
      // Notes never appear as customer-facing activity.
      expect(staffView.lastStaffMessageAt).toBeNull();
    });

    it('a consultation moves the case to waiting_internal and the answer brings it back when nothing else is pending', async () => {
      const created = await service.createCase(alice, { category: 'deposits_withdrawals', message: 'Saque atrasado' });
      const first = await service.requestConsultation(ana, created.id, { team: 'finance', question: 'O saque #123 foi enviado?' });
      expect(first).toMatchObject({ team: 'finance', status: 'open', requestedById: ana.id });
      let view = await service.getStaffCase(created.id);
      expect(view).toMatchObject({ status: 'waiting_internal', assignedAgentId: ana.id });
      expect(view.consultations).toHaveLength(1);

      const second = await service.requestConsultation(ana, created.id, { team: 'security', question: 'Há alerta na conta?' });
      // A customer reply keeps the internal dependency (§7.2).
      await service.postCustomerMessage(alice, created.id, { body: 'Novidades?' });
      expect((await service.getStaffCase(created.id)).status).toBe('waiting_internal');

      await service.answerConsultation(bruno, created.id, first.id, { answer: 'Enviado às 14:02, hash 0xabc.' });
      expect((await service.getStaffCase(created.id)).status).toBe('waiting_internal'); // security still open
      const answered = await service.answerConsultation(bruno, created.id, second.id, { answer: 'Sem alertas.' });
      expect(answered).toMatchObject({ status: 'answered', answeredById: bruno.id, answeredByName: 'Bruno' });
      view = await service.getStaffCase(created.id);
      expect(view.status).toBe('in_progress');
      expect(view.events.map((e) => e.type)).toEqual(expect.arrayContaining(['consultation_requested', 'consultation_answered']));

      await expect(service.answerConsultation(bruno, created.id, first.id, { answer: 'de novo' })).rejects.toBeInstanceOf(ConflictException);
      await expect(service.answerConsultation(bruno, created.id, '00000000-0000-4000-8000-000000000000', { answer: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('read markers and unread counts (PH-2.2)', () => {
    it('counts staff replies as unread for the customer until they mark the case read, and vice versa', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      expect(created.unreadCount).toBe(0);
      expect((await service.listStaffCases(ana, 'unassigned'))[0].unreadCount).toBe(1); // the customer's first message

      await service.markStaffRead(ana, created.id);
      expect((await service.listStaffCases(ana, 'unassigned'))[0].unreadCount).toBe(0);

      await service.postStaffMessage(ana, created.id, { body: 'Olá' });
      await service.postStaffMessage(ana, created.id, { body: 'Estou verificando' });
      const forCustomer = await service.listCustomerCases(alice);
      expect(forCustomer[0].unreadCount).toBe(2);
      expect((await service.getCustomerCase(alice, created.id)).unreadCount).toBe(2);

      const afterRead = await service.markCustomerRead(alice, created.id);
      expect(afterRead.customerLastReadAt).not.toBeNull();
      expect((await service.listCustomerCases(alice))[0].unreadCount).toBe(0);
      // Staff can see that the reply was read.
      const staffView = await service.getStaffCase(created.id);
      expect(new Date(staffView.customerLastReadAt!).getTime()).toBeGreaterThanOrEqual(new Date(staffView.lastStaffMessageAt!).getTime());
    });

    it('never counts internal notes as unread for the customer (RULE-SUP-04)', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await db.insert(caseMessages).values({ caseId: created.id, authorType: 'staff', authorId: ana.id, visibility: 'internal', body: 'nota' });
      expect((await service.listCustomerCases(alice))[0].unreadCount).toBe(0);
    });

    it('another customer cannot mark the case read', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await expect(service.markCustomerRead(bob, created.id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('live events (ADR-0004)', () => {
    it('publishes case.updated and message.created after each committed write, with the summary and message', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      expect(published.map((e) => e.type)).toEqual(['case.updated', 'message.created']);
      expect(published[0]).toMatchObject({ caseId: created.id, customerId: alice.id, summary: { reference: created.reference } });

      published = [];
      await service.postStaffMessage(ana, created.id, { body: 'Olá' });
      expect(published.map((e) => e.type)).toEqual(['message.created', 'case.updated']);
      const messageEvent = published[0];
      if (messageEvent.type !== 'message.created') throw new Error('expected message.created');
      expect(messageEvent.message).toMatchObject({ authorType: 'staff', authorName: 'Ana', body: 'Olá' });
      const updated = published[1];
      if (updated.type !== 'case.updated') throw new Error('expected case.updated');
      expect(updated.summary).toMatchObject({ assignedAgentId: ana.id, status: 'in_progress' });
    });
  });

  describe('customer creates a case', () => {
    it('creates the case with a SUP reference, status new and the first public message', async () => {
      const detail = await service.createCase(alice, {
        category: 'deposits_withdrawals',
        message: 'Meu saque não chegou\nFiz ontem à noite.',
      });
      expect(detail.reference).toMatch(/^SUP-\d{6}$/);
      expect(detail.status).toBe('new');
      expect('assignedAgentId' in detail).toBe(false); // staff-only fields never reach the customer (FND-0006)
      expect(detail.subject).toBe('Meu saque não chegou');
      expect(detail.messages).toHaveLength(1);
      expect(detail.messages[0]).toMatchObject({ authorType: 'customer', authorId: alice.id, visibility: 'public' });
      expect(detail.lastCustomerMessageAt).toBe(detail.lastMessageAt);
    });

    it('gives consecutive cases distinct references', async () => {
      const first = await service.createCase(alice, { category: 'other', message: 'Primeira' });
      const second = await service.createCase(alice, { category: 'other', message: 'Segunda' });
      expect(first.reference).not.toBe(second.reference);
      expect(Number(second.reference.slice(4))).toBeGreaterThan(Number(first.reference.slice(4)));
    });

    it('returns the same case when the same clientMessageId is submitted again (retry)', async () => {
      const input = { category: 'operations' as const, message: 'Operação não liquidou', clientMessageId: 'retry-1' };
      const first = await service.createCase(alice, input);
      const second = await service.createCase(alice, input);
      expect(second.id).toBe(first.id);
      expect(await service.listCustomerCases(alice)).toHaveLength(1);
    });
  });

  describe('customer visibility (RULE-SUP-01, RULE-SUP-04)', () => {
    it('lists only the caller’s cases', async () => {
      await service.createCase(alice, { category: 'other', message: 'Da Alice' });
      await service.createCase(bob, { category: 'other', message: 'Do Bob' });
      const forBob = await service.listCustomerCases(bob);
      expect(forBob).toHaveLength(1);
      expect(forBob[0].customerId).toBe(bob.id);
    });

    it('answers not-found when another customer asks for the case by id', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Privado' });
      await expect(service.getCustomerCase(bob, created.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.postCustomerMessage(bob, created.id, { body: 'oi' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('hides internal notes from the customer but shows them to staff', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Pergunta' });
      await db.insert(caseMessages).values({
        caseId: created.id,
        authorType: 'staff',
        authorId: ana.id,
        visibility: 'internal',
        body: 'Nota interna: verificar com Finance',
      });
      const customerView = await service.getCustomerCase(alice, created.id);
      expect(customerView.messages.map((m) => m.visibility)).toEqual(['public']);
      const staffView = await service.getStaffCase(created.id);
      expect(staffView.messages.map((m) => m.visibility)).toEqual(['public', 'internal']);
    });
  });

  describe('staff queue, take and reply (RULE-SUP-02, RULE-SUP-09)', () => {
    it('shows new cases in the unassigned queue, oldest first', async () => {
      const first = await service.createCase(alice, { category: 'other', message: 'Primeiro' });
      const second = await service.createCase(bob, { category: 'other', message: 'Segundo' });
      const queue = await service.listStaffCases(ana, 'unassigned');
      expect(queue.map((c) => c.id)).toEqual([first.id, second.id]);
    });

    it('take assigns the case, moves it to in_progress and records attributable events', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const taken = await service.takeCase(ana, created.id);
      expect(taken).toMatchObject({ assignedAgentId: ana.id, status: 'in_progress' });

      expect(await service.listStaffCases(ana, 'unassigned')).toHaveLength(0);
      expect((await service.listStaffCases(ana, 'mine')).map((c) => c.id)).toEqual([created.id]);
      expect((await service.listStaffCases(bruno, 'mine'))).toHaveLength(0);

      const events = (await service.getStaffCase(created.id)).events;
      expect(events.map((e) => e.type)).toEqual(['case_created', 'case_assigned', 'status_changed']);
      expect(events[1]).toMatchObject({ actorType: 'staff', actorId: ana.id });
    });

    it('refuses to take a case owned by another agent, but is idempotent for the owner', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await service.takeCase(ana, created.id);
      await expect(service.takeCase(bruno, created.id)).rejects.toBeInstanceOf(ConflictException);
      const again = await service.takeCase(ana, created.id);
      expect(again.assignedAgentId).toBe(ana.id);
    });

    it('a staff reply becomes visible to the customer and makes the replier responsible', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const reply = await service.postStaffMessage(ana, created.id, { body: 'Olá, Alice! Já estou verificando.' });
      expect(reply).toMatchObject({ authorType: 'staff', authorId: ana.id, authorName: 'Ana', visibility: 'public' });

      const customerView = await service.getCustomerCase(alice, created.id);
      expect(customerView.status).toBe('in_progress');
      expect((await service.getStaffCase(created.id)).assignedAgentId).toBe(ana.id);
      expect(customerView.messages.map((m) => m.body)).toEqual(['Ajuda', 'Olá, Alice! Já estou verificando.']);
      expect(customerView.lastStaffMessageAt).not.toBeNull();
    });
  });

  describe('customer replies and the simple reactivation rule (§7.2)', () => {
    it('a customer message on a resolved case reactivates it with a reopened event', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await db
        .update(supportCases)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(supportCases.id, created.id));

      await service.postCustomerMessage(alice, created.id, { body: 'Obrigada!' });

      const view = await service.getStaffCase(created.id);
      expect(view.status).toBe('in_progress');
      expect(view.events.map((e) => e.type)).toContain('case_reopened');
    });

    it('a customer message while waiting for the customer returns the case to active attention', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await db.update(supportCases).set({ status: 'waiting_customer' }).where(eq(supportCases.id, created.id));
      await service.postCustomerMessage(alice, created.id, { body: 'Segue o comprovante' });
      expect((await service.getCustomerCase(alice, created.id)).status).toBe('in_progress');
    });

    it('a retried customer message with the same clientMessageId is stored once', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const a = await service.postCustomerMessage(alice, created.id, { body: 'Mais um detalhe', clientMessageId: 'm-1' });
      const b = await service.postCustomerMessage(alice, created.id, { body: 'Mais um detalhe', clientMessageId: 'm-1' });
      expect(b.id).toBe(a.id);
      expect((await service.getCustomerCase(alice, created.id)).messages).toHaveLength(2);
    });

    it('stores exactly one message when the same clientMessageId is sent concurrently (RULE-SUP-03, PH-2.4)', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const input = { body: 'Enviado duas vezes ao mesmo tempo', clientMessageId: 'race-1' };
      const results = await Promise.all([
        service.postCustomerMessage(alice, created.id, input),
        service.postCustomerMessage(alice, created.id, input),
        service.postCustomerMessage(alice, created.id, input),
      ]);
      expect(new Set(results.map((m) => m.id)).size).toBe(1);
      expect((await service.getCustomerCase(alice, created.id)).messages).toHaveLength(2);

      const staffInput = { body: 'Resposta dupla', clientMessageId: 'race-staff-1' };
      const staffResults = await Promise.all([
        service.postStaffMessage(ana, created.id, staffInput),
        service.postStaffMessage(ana, created.id, staffInput),
      ]);
      expect(new Set(staffResults.map((m) => m.id)).size).toBe(1);
      expect((await service.getStaffCase(created.id)).messages).toHaveLength(3);
    });

    it('refuses messages on a closed case until linked follow-ups exist (PH-3)', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await db.update(supportCases).set({ status: 'closed', closedAt: new Date() }).where(eq(supportCases.id, created.id));
      await expect(service.postCustomerMessage(alice, created.id, { body: 'Oi?' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('Cycle Audit 1 regressions', () => {
    it('FND-0006: customer responses never carry staff-only fields, even with an incident linked and a priority set', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const incident = await service.createIncident(ana, { title: 'INTERNO: provedor fora' });
      await service.linkIncident(ana, created.id, incident.id);
      await service.updateAttributes(ana, created.id, { priority: 'urgent' });
      const detail = await service.getCustomerCase(alice, created.id);
      const [listed] = await service.listCustomerCases(alice);
      const read = await service.markCustomerRead(alice, created.id);
      for (const view of [detail, listed, read]) {
        for (const field of STAFF_ONLY_SUMMARY_FIELDS) expect(field in view).toBe(false);
      }
      expect(JSON.stringify([detail, listed, read])).not.toContain('provedor fora');
      expect((await service.getStaffCase(created.id)).incidentTitle).toBe('INTERNO: provedor fora');
    });

    it('FND-0007: a transfer to an agent outside the staff directory is refused and changes nothing', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await service.takeCase(ana, created.id);
      await expect(service.assignCase(ana, created.id, { agentId: 'ghost-agent' })).rejects.toBeInstanceOf(BadRequestException);
      const view = await service.getStaffCase(created.id);
      expect(view.assignedAgentId).toBe(ana.id);
      expect(view.events.filter((e) => e.type === 'case_assigned')).toHaveLength(1);
      await expect(service.assignCase(carla, created.id, { agentId: bruno.id })).resolves.toMatchObject({ assignedAgentId: bruno.id });
    });

    it('FND-0008: no resolution while a consultation is open; a closed case accepts no answer', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const consultation = await service.requestConsultation(ana, created.id, { team: 'finance', question: 'Saldo?' });
      await expect(service.resolve(ana, created.id, { reason: 'solved', explanation: 'Feito' })).rejects.toThrow('consultations_open');
      expect((await service.getStaffCase(created.id)).status).toBe('waiting_internal');
      await service.answerConsultation(bruno, created.id, consultation.id, { answer: 'Confere' });
      await service.resolve(ana, created.id, { reason: 'solved', explanation: 'Feito' });
      await service.closeCase(ana, created.id);
      const [orphan] = await db.insert(caseConsultations).values({ caseId: created.id, team: 'finance', question: 'q', requestedById: ana.id }).returning();
      await expect(service.answerConsultation(bruno, created.id, orphan.id, { answer: 'tarde demais' })).rejects.toThrow('case_closed');
      expect((await service.getStaffCase(created.id)).events.at(-1)?.type).toBe('case_closed');
    });

    it('FND-0009: two agents taking the same case at once — exactly one succeeds and one assignment is recorded', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      const results = await Promise.allSettled([service.takeCase(ana, created.id), service.takeCase(bruno, created.id)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConflictException);
      const view = await service.getStaffCase(created.id);
      expect(view.events.filter((e) => e.type === 'case_assigned')).toHaveLength(1);
      expect(view.events.filter((e) => e.type === 'status_changed')).toHaveLength(1);
      expect([ana.id, bruno.id]).toContain(view.assignedAgentId);
    });

    it('FND-0009: overlapping closure runs close a resolved case once and report only real closures', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await service.resolve(ana, created.id, { reason: 'solved', explanation: 'Feito' });
      const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const [a, b] = await Promise.all([service.closeExpired(later), service.closeExpired(later)]);
      expect(a + b).toBe(1);
      const view = await service.getStaffCase(created.id);
      expect(view.status).toBe('closed');
      expect(view.events.filter((e) => e.type === 'case_closed')).toHaveLength(1);
      expect(published.filter((e) => e.type === 'case.updated' && e.caseId === created.id && e.summary.status === 'closed')).toHaveLength(1);
    });

    it('FND-0010: the idempotency key is scoped to the case and the author; a creation key is never answered with another case', async () => {
      const a = await service.createCase(alice, { category: 'other', message: 'A', clientMessageId: 'create-1' });
      expect((await service.createCase(alice, { category: 'other', message: 'A', clientMessageId: 'create-1' })).id).toBe(a.id);
      const b = await service.createCase(alice, { category: 'other', message: 'B' });
      const onA = await service.postCustomerMessage(alice, a.id, { body: 'para A', clientMessageId: 'k-1' });
      const onB = await service.postCustomerMessage(alice, b.id, { body: 'para B', clientMessageId: 'k-1' });
      expect(onB.id).not.toBe(onA.id);
      expect(onB.caseId).toBe(b.id);
      expect((await service.getCustomerCase(alice, b.id)).messages.map((m) => m.body)).toEqual(['B', 'para B']);
      // A staff id equal to a customer id string is a different author: no collision, no foreign message.
      const homonym: StaffActor = { ...ana, id: alice.id };
      const staffMessage = await service.postStaffMessage(homonym, a.id, { body: 'da equipe', clientMessageId: 'k-1' });
      expect(staffMessage).toMatchObject({ authorType: 'staff', body: 'da equipe' });
      // Creation keys: a follow-up cannot reuse a root creation key and vice versa; a retried follow-up is single.
      await db.update(supportCases).set({ status: 'closed', closedAt: new Date() }).where(eq(supportCases.id, b.id));
      await expect(service.createFollowUp(alice, b.id, { message: 'x', clientMessageId: 'create-1' })).rejects.toThrow('client_message_id_reused');
      const follow = await service.createFollowUp(alice, b.id, { message: 'x', clientMessageId: 'follow-1' });
      expect((await service.createFollowUp(alice, b.id, { message: 'x', clientMessageId: 'follow-1' })).id).toBe(follow.id);
      await expect(service.createCase(alice, { category: 'other', message: 'x', clientMessageId: 'follow-1' })).rejects.toThrow('client_message_id_reused');
      expect((await service.listCustomerCases(alice)).map((c) => c.id).sort()).toEqual([a.id, b.id, follow.id].sort());
    });

    it('FND-0013: every exit from resolved clears the resolution and records a reopening with its actor', async () => {
      const first = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await service.resolve(ana, first.id, { reason: 'solved', explanation: 'Feito' });
      const resumed = await service.setStatus(ana, first.id, 'waiting_customer');
      expect(resumed).toMatchObject({ status: 'waiting_customer', resolvedAt: null, resolutionReason: null });
      expect((await service.getStaffCase(first.id)).events.at(-1)).toMatchObject({ type: 'case_reopened', actorId: ana.id, data: { from: 'resolved', to: 'waiting_customer' } });

      const second = await service.createCase(alice, { category: 'other', message: 'Ajuda' });
      await service.resolve(ana, second.id, { reason: 'solved', explanation: 'Feito' });
      await service.requestConsultation(ana, second.id, { team: 'finance', question: 'Confere?' });
      const view = await service.getStaffCase(second.id);
      expect(view).toMatchObject({ status: 'waiting_internal', resolvedAt: null, resolutionReason: null });
      expect(view.events.some((e) => e.type === 'case_reopened' && e.data.to === 'waiting_internal')).toBe(true);
    });
  });


  describe('records and contextual entry (PH-4.2, §4.2)', () => {
    it('a case opened from a record keeps a snapshot of it, exposes it on both details and records it in history', async () => {
      const created = await service.createCase(alice, { category: 'deposits_withdrawals', message: 'Meu saque não chegou', record: { kind: 'withdrawal', reference: 'WD-48213' } });
      expect(created.recordKind).toBe('withdrawal');
      expect(created.record).toMatchObject({ kind: 'withdrawal', reference: 'WD-48213', lookupReason: null });
      expect(created.record?.snapshot).toMatchObject({ title: 'Saque 250 USDT', status: 'Em processamento' });
      const staffView = await service.getStaffCase(created.id);
      expect(staffView.record?.snapshot?.facts.some((f) => f.label === 'Destino' && f.value === 'TX7f…9k2Q')).toBe(true);
      expect(staffView.events[0]).toMatchObject({ type: 'case_created', data: { record: { kind: 'withdrawal', reference: 'WD-48213', snapshotCaptured: true } } });
      const [listed] = await service.listCustomerCases(alice);
      expect(listed).toMatchObject({ recordKind: 'withdrawal', recordReference: 'WD-48213' });
    });

    it('a record the adapter cannot find still opens the case — as an investigation, with the reason on the card (RULE-SUP-07)', async () => {
      const created = await service.createCase(bob, { category: 'operations', message: 'Cadê?', record: { kind: 'withdrawal', reference: 'WD-48213' } });
      expect(created.record).toMatchObject({ kind: 'withdrawal', reference: 'WD-48213', snapshot: null, lookupReason: 'not_found' });
      expect(JSON.stringify(created)).not.toContain('Saque 250'); // Alice's record never leaks to Bob (RULE-SUP-01)
      expect(await service.currentRecord(await service.requireCaseRow(created.id))).toMatchObject({ state: 'unavailable', reason: 'not_found' });
    });

    it('the active case per record is reported so the panel can offer to continue it; resolved cases are not active', async () => {
      const created = await service.createCase(alice, { category: 'deposits_withdrawals', message: 'Saque', record: { kind: 'withdrawal', reference: 'WD-48213' } });
      await service.createCase(alice, { category: 'other', message: 'Sem registro' });
      const active = await service.activeCasesByRecord(alice);
      expect([...active.keys()]).toEqual(['withdrawal:WD-48213']);
      expect(active.get('withdrawal:WD-48213')).toMatchObject({ id: created.id, reference: created.reference });
      await service.resolve(ana, created.id, { reason: 'solved', explanation: 'Chegou' });
      expect((await service.activeCasesByRecord(alice)).size).toBe(0);
      expect((await service.currentRecord(await service.requireCaseRow(created.id)))).toMatchObject({ state: 'available', data: { reference: 'WD-48213' } });
    });
  });


  describe('queue views for every state (PH-5.1, §14 item 9)', () => {
    it('lists waiting, resolved and closed cases in their own views, ordered for attention, and paginates', async () => {
      const a = await service.createCase(alice, { category: 'other', message: 'A' });
      const b = await service.createCase(alice, { category: 'other', message: 'B' });
      const c = await service.createCase(alice, { category: 'other', message: 'C' });
      const d = await service.createCase(bob, { category: 'other', message: 'D' });
      await service.setStatus(ana, a.id, 'waiting_customer');
      await service.requestConsultation(ana, b.id, { team: 'finance', question: '?' });
      await service.resolve(ana, c.id, { reason: 'solved', explanation: 'ok' });
      await service.resolve(ana, d.id, { reason: 'solved', explanation: 'ok' });
      await service.closeCase(ana, d.id);

      expect((await service.listStaffCases(ana, 'waiting_customer')).map((x) => x.id)).toEqual([a.id]);
      expect((await service.listStaffCases(ana, 'waiting_internal')).map((x) => x.id)).toEqual([b.id]);
      expect((await service.listStaffCases(ana, 'resolved')).map((x) => x.id)).toEqual([c.id]);
      expect((await service.listStaffCases(ana, 'closed')).map((x) => x.id)).toEqual([d.id]);
      expect((await service.listStaffCases(ana, 'active')).map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
      expect(await service.listStaffCases(ana, 'active', { limit: 1, offset: 1 })).toHaveLength(1);
      expect(await service.listStaffCases(ana, 'active', { limit: 1, offset: 5 })).toHaveLength(0);
    });

    it('awaitingReplySince marks unanswered customer messages, clears on a staff reply, sorts first, and never reaches customers', async () => {
      const quiet = await service.createCase(alice, { category: 'other', message: 'Sem pressa' });
      await service.postStaffMessage(ana, quiet.id, { body: 'Respondido' });
      const loud = await service.createCase(bob, { category: 'other', message: 'Urgente' });
      const active = await service.listStaffCases(ana, 'active');
      expect(active[0].id).toBe(loud.id);
      expect(active[0].awaitingReplySince).not.toBeNull();
      expect(active.find((x) => x.id === quiet.id)?.awaitingReplySince).toBeNull();
      await service.postCustomerMessage(alice, quiet.id, { body: 'Mais uma dúvida' });
      expect((await service.getStaffCase(quiet.id)).awaitingReplySince).not.toBeNull();
      await service.setStatus(ana, quiet.id, 'waiting_customer');
      expect((await service.getStaffCase(quiet.id)).awaitingReplySince).toBeNull();
      expect('awaitingReplySince' in (await service.getCustomerCase(alice, quiet.id))).toBe(false);
    });
  });


  describe('search and filters (PH-5.2, §5.2)', () => {
    it('finds a case by reference (with or without the prefix), customer id, subject words or record reference, and narrows by filters', async () => {
      const saque = await service.createCase(alice, { category: 'deposits_withdrawals', message: 'Saque atrasado', record: { kind: 'withdrawal', reference: 'WD-48213' } });
      const outro = await service.createCase(bob, { category: 'other', message: 'Pergunta geral' });
      await service.updateAttributes(ana, outro.id, { priority: 'high' });
      await service.takeCase(ana, outro.id);
      const ids = async (q?: string, extra: Record<string, string> = {}) =>
        (await service.listStaffCases(ana, 'active', { limit: 50, offset: 0 }, { q, ...extra })).map((c) => c.id);
      expect(await ids(saque.reference)).toEqual([saque.id]);
      expect(await ids(String(Number(saque.reference.slice(4))))).toEqual([saque.id]);
      expect(await ids('cust-bob')).toEqual([outro.id]);
      expect(await ids('SAQUE')).toEqual([saque.id]);
      expect(await ids('wd-482')).toEqual([saque.id]);
      expect(await ids('%')).toEqual([]);
      expect(await ids(undefined, { priority: 'high' })).toEqual([outro.id]);
      expect(await ids(undefined, { category: 'deposits_withdrawals' })).toEqual([saque.id]);
      expect(await ids(undefined, { agentId: 'unassigned' })).toEqual([saque.id]);
      expect(await ids(undefined, { agentId: ana.id })).toEqual([outro.id]);
      expect(await ids('cust', { priority: 'normal' })).toEqual([saque.id]);
    });
  });


  describe('supervision and configuration (PH-5.4, §5.4)', () => {
    it('overview counts demand, load per agent and overdue cases; metrics describe the period without targets', async () => {
      const supervision = moduleRef.get(SupervisionService);
      const settings = moduleRef.get(SettingsService);
      await expect(supervision.overview(ana)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(settings.update(ana, { ...(await settings.get()) })).rejects.toBeInstanceOf(ForbiddenException);

      const old = await service.createCase(alice, { category: 'other', message: 'Antigo sem resposta' });
      await db.update(supportCases).set({ createdAt: new Date(Date.now() - 6 * 3_600_000), lastCustomerMessageAt: new Date(Date.now() - 6 * 3_600_000) }).where(eq(supportCases.id, old.id));
      const answered = await service.createCase(bob, { category: 'other', message: 'Respondido' });
      await service.postStaffMessage(ana, answered.id, { body: 'Olá' });
      const done = await service.createCase(alice, { category: 'other', message: 'Feito' });
      await service.resolve(ana, done.id, { reason: 'solved', explanation: 'ok' });
      await service.postCustomerMessage(alice, done.id, { body: 'Ainda não' }); // reopened

      const overview = await supervision.overview(carla);
      expect(overview.unassigned.count).toBe(1);
      expect(overview.awaitingReply.count).toBe(2); // old + reopened
      expect(overview.byAgent.find((a) => a.agentId === ana.id)).toMatchObject({ open: 2, awaitingReply: 1 });
      expect(overview.overdue.map((c) => c.id)).toEqual([old.id]); // 6 h > 4 h threshold
      expect(overview.byStatus.in_progress).toBe(2);

      const metrics = await supervision.metrics(carla, 7);
      expect(metrics).toMatchObject({ created: 3, resolved: 1, reopened: 1, reopenRate: 1, targets: null });
      expect(metrics.firstResponse.count).toBe(2); // 'Olá' and the resolution explanation
      expect(metrics.resolution.count).toBe(1);
      expect(metrics.unansweredNow.count).toBe(2);

      const saved = await settings.update(carla, { ...(await settings.get()), attentionThresholdHours: 12 });
      expect(saved).toMatchObject({ workingDefault: false, updatedById: carla.id, attentionThresholdHours: 12 });
      expect((await supervision.overview(carla)).overdue).toHaveLength(0);
      // BL-021 (PH-8.1): a case waiting for an internal team longer than the threshold is overdue too, and its age is exposed to staff only.
      const team = await service.createCase(alice, { category: 'other', message: 'Preciso da equipe' });
      await service.setStatus(ana, team.id, 'waiting_internal');
      await db.update(supportCases).set({ waitingInternalSince: new Date(Date.now() - 800 * 3_600_000) }).where(eq(supportCases.id, team.id)); // older than any threshold (max 720 h)
      const later = await supervision.overview(carla);
      expect(later.waitingInternal).toMatchObject({ count: 1, oldestSince: expect.any(String) });
      expect(later.overdue.map((c) => c.id)).toContain(team.id);
      const [teamSummary] = await service.listStaffCases(carla, 'waiting_internal');
      expect(teamSummary.waitingInternalSince).toEqual(expect.any(String));
      expect('waitingInternalSince' in (await service.listCustomerCases(alice)).find((c) => c.id === team.id)!).toBe(false);
      expect(await settings.followUpWindowDays()).toBe(7);
    });
  });


  describe('in-product notifications (PH-6.1, §4.4)', () => {
    it('records one notification per customer-facing change, none for internal work, marks them read when the case is opened, and isolates customers', async () => {
      const notifications = moduleRef.get(NotificationsService);
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      await service.postInternalNote(ana, created.id, { body: 'nota' });
      const consultation = await service.requestConsultation(ana, created.id, { team: 'finance', question: '?' });
      await service.answerConsultation(bruno, created.id, consultation.id, { answer: 'ok' });
      expect(await notifications.list(alice)).toHaveLength(0);
      const input = { body: 'Resposta', clientMessageId: 'n-1' };
      await service.postStaffMessage(ana, created.id, input);
      await service.postStaffMessage(ana, created.id, input); // retry: same message, no second notification
      await service.setStatus(ana, created.id, 'waiting_customer');
      await service.resolve(ana, created.id, { reason: 'solved', explanation: 'Feito' });
      await service.closeCase(ana, created.id);
      const list = await notifications.list(alice);
      expect(list.map((n) => n.kind)).toEqual(['closed', 'resolved', 'waiting_customer', 'staff_reply']);
      expect(list.every((n) => n.readAt === null && n.caseReference === created.reference)).toBe(true);
      expect(await notifications.unreadCount(alice)).toBe(4);
      expect(await notifications.list(bob)).toHaveLength(0);
      expect(await notifications.markRead(bob, { caseId: created.id })).toBe(0);
      await service.markCustomerRead(alice, created.id);
      expect(await notifications.unreadCount(alice)).toBe(0);
      expect((await notifications.list(alice)).every((n) => n.readAt !== null)).toBe(true);
    });
  });


  describe('e-mail notifications through the boundary (PH-6.2, §4.4)', () => {
    it('e-mails an unread notification once after the delay, never a read one, respects the opt-out, and carries no message content', async () => {
      const job = moduleRef.get(NotificationJob);
      const notifications = moduleRef.get(NotificationsService);
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      await service.postStaffMessage(ana, created.id, { body: 'SEGREDO: resposta completa' });
      // Not due yet (default delay 15 min).
      expect(await job.emailDue(new Date())).toBe(0);
      const later = new Date(Date.now() + 16 * 60_000);
      expect(await job.emailDue(later)).toBe(1);
      expect(await job.emailDue(later)).toBe(0); // once
      const [email] = await job.outbox(alice);
      expect(email).toMatchObject({ kind: 'staff_reply', toMasked: 'a***@e***.com', delivery: 'simulated', link: `/?case=${created.id}` });
      expect(email.subject).toContain(created.reference);
      expect(JSON.stringify(await job.outbox(alice))).not.toContain('SEGREDO');
      expect(await job.outbox(bob)).toHaveLength(0);

      // A notification read before the delay is never e-mailed.
      await service.setStatus(ana, created.id, 'waiting_customer');
      await notifications.markRead(alice, { caseId: created.id });
      expect(await job.emailDue(new Date(Date.now() + 60 * 60_000))).toBe(0);

      // Opt-out: due notifications are skipped (and not retried); a customer unknown to Orbit has no address.
      await job.updatePreferences(alice, { emailNotifications: false });
      await service.resolve(ana, created.id, { reason: 'solved', explanation: 'Feito' });
      expect(await job.emailDue(new Date(Date.now() + 60 * 60_000))).toBe(0);
      expect(await job.outbox(alice)).toHaveLength(1);
      const ghost: CustomerActor = { kind: 'customer', id: 'cust-ghost', source: 'simulated' };
      const ghostCase = await service.createCase(ghost, { category: 'other', message: 'Oi' });
      await service.postStaffMessage(ana, ghostCase.id, { body: 'Olá' });
      expect(await job.emailDue(new Date(Date.now() + 60 * 60_000))).toBe(0);
      expect(await job.outbox(ghost)).toHaveLength(0);

      // FND-0032: while Orbit cannot answer, nothing is marked as e-mailed; the e-mail goes out once Orbit is back.
      const bruno: CustomerActor = { kind: 'customer', id: 'cust-bruno', source: 'simulated' }; // known to the simulated Orbit
      const outage = await service.createCase(bruno, { category: 'other', message: 'Oi' });
      await service.postStaffMessage(ana, outage.id, { body: 'Olá' });
      orbitEnv.SUPPORT_SIMULATED_ORBIT = 'unavailable';
      try {
        expect(await job.emailDue(new Date(Date.now() + 60 * 60_000))).toBe(0);
        expect(await job.outbox(bruno)).toHaveLength(0);
      } finally {
        delete orbitEnv.SUPPORT_SIMULATED_ORBIT;
      }
      expect(await job.emailDue(new Date(Date.now() + 60 * 60_000))).toBe(1);
      expect(await job.outbox(bruno)).toHaveLength(1);
    });
  });


  describe('role model (PH-7.2, DEC-0029, RULE-SUP-02)', () => {
    it('an agent may reply, note and answer consultations on a colleague\'s case but not change its state; the owner and a supervisor may', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      await service.postStaffMessage(ana, created.id, { body: 'Olá, sou a Ana.' }); // Ana becomes responsible
      // Bruno (agent, not the owner): open actions work and never change the owner.
      await service.postStaffMessage(bruno, created.id, { body: 'Complemento do Bruno.' });
      await service.postInternalNote(bruno, created.id, { body: 'Nota do Bruno.' });
      expect((await service.getStaffCase(created.id)).assignedAgentId).toBe(ana.id);
      const consultation = await service.requestConsultation(ana, created.id, { team: 'finance', question: 'Confere?' });
      await service.answerConsultation(bruno, created.id, consultation.id, { answer: 'Confere.' });
      // State-changing actions on someone else's case are refused for an agent.
      await expect(service.setStatus(bruno, created.id, 'waiting_customer')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.requestConsultation(bruno, created.id, { team: 'finance', question: 'De novo?' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.updateAttributes(bruno, created.id, { priority: 'high' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.resolve(bruno, created.id, { reason: 'solved', explanation: 'ok' })).rejects.toBeInstanceOf(ForbiddenException);
      const incident = await service.createIncident(bruno, { title: 'Instabilidade' });
      await expect(service.linkIncident(bruno, created.id, incident.id)).rejects.toBeInstanceOf(ForbiddenException);
      expect((await service.getStaffCase(created.id)).status).toBe('in_progress');
      // The owner and a supervisor may.
      await service.updateAttributes(ana, created.id, { priority: 'high' });
      await service.setStatus(carla, created.id, 'waiting_customer');
      await service.resolve(carla, created.id, { reason: 'solved', explanation: 'Resolvido pela supervisora.' });
      await expect(service.closeCase(bruno, created.id)).rejects.toBeInstanceOf(ForbiddenException);
      await service.closeCase(ana, created.id);
      expect((await service.getStaffCase(created.id)).status).toBe('closed');
    });
  });

  describe('outside-hours notice and reminders (PH-6.3, §4.4, §7.4)', () => {
    it('posts one system notice per case per 12 h while support is closed, notifies, and never counts as a human reply', async () => {
      const settings = moduleRef.get(SettingsService);
      const supervision = moduleRef.get(SupervisionService);
      const notifications = moduleRef.get(NotificationsService);
      const closed = { ...(await settings.get()), schedule: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null } };
      await settings.update(carla, closed);
      try {
        const created = await service.createCase(alice, { category: 'other', message: 'Boa noite' });
        await service.postCustomerMessage(alice, created.id, { body: 'Ainda aí?' });
        const view = await service.getStaffCase(created.id);
        const notices = view.messages.filter((m) => m.authorType === 'system' && m.body.startsWith('Fora do horário'));
        expect(notices).toHaveLength(1);
        // PH-9.2: the notice says what it is, so clients word it; no next opening while every day is closed.
        expect(notices[0]).toMatchObject({ systemKind: 'outside_hours', systemData: {} });
        expect((await notifications.list(alice)).map((n) => n.kind)).toEqual(['outside_hours']);
        const metrics = await supervision.metrics(carla, 7);
        expect(metrics.firstResponse.count).toBe(0); // the notice is not a human response
        expect(view.awaitingReplySince).not.toBeNull();
        // FND-0042: a follow-up opened at night is told the same as a new case.
        const parent = await service.createCase(alice, { category: 'other', message: 'Antigo' });
        await service.resolve(ana, parent.id, { reason: 'solved', explanation: 'ok' });
        await service.closeCase(ana, parent.id);
        const child = await service.createFollowUp(alice, parent.id, { message: 'Voltou a acontecer' });
        const childView = await service.getStaffCase(child.id);
        expect(childView.messages.filter((m) => m.authorType === 'system' && m.body.startsWith('Fora do horário'))).toHaveLength(1);
        expect(childView.messages.find((m) => m.systemKind === 'follow_up_of')?.systemData).toEqual({ reference: parent.reference });
      } finally {
        await settings.update(carla, { ...closed, schedule: { mon: { open: '00:00', close: '24:00' }, tue: { open: '00:00', close: '24:00' }, wed: { open: '00:00', close: '24:00' }, thu: { open: '00:00', close: '24:00' }, fri: { open: '00:00', close: '24:00' }, sat: { open: '00:00', close: '24:00' }, sun: { open: '00:00', close: '24:00' } } });
      }
      const open = await service.createCase(alice, { category: 'other', message: 'Bom dia' });
      expect((await service.getStaffCase(open.id)).messages.some((m) => m.authorType === 'system')).toBe(false);
    });

    it('reminds a case waiting for the customer once per period, records the event, and resets when the customer replies', async () => {
      const job = moduleRef.get(ReminderJob);
      const notifications = moduleRef.get(NotificationsService);
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      await service.postStaffMessage(ana, created.id, { body: 'Pode enviar o comprovante?' });
      await service.setStatus(ana, created.id, 'waiting_customer');
      expect(await job.remindDue(new Date())).toBe(0); // 48 h not elapsed
      const later = new Date(Date.now() + 49 * 3_600_000);
      expect(await job.remindDue(later)).toBe(1);
      expect(await job.remindDue(later)).toBe(0); // once per period
      let view = await service.getStaffCase(created.id);
      expect(view.status).toBe('waiting_customer');
      expect(view.events.at(-1)).toMatchObject({ type: 'reminder_sent', actorType: 'system' });
      expect((await notifications.list(alice)).map((n) => n.kind)).toContain('reminder');
      await service.postCustomerMessage(alice, created.id, { body: 'Segue' });
      await service.setStatus(ana, created.id, 'waiting_customer');
      expect(await job.remindDue(new Date(Date.now() + 100 * 3_600_000))).toBe(1); // a new waiting period reminds again
      // FND-0033: an old staff reply does not count — the wait starts when the case enters waiting_customer.
      const stale = await service.createCase(alice, { category: 'other', message: 'Oi' });
      await service.postStaffMessage(ana, stale.id, { body: 'Pode enviar o comprovante?' });
      await db.update(supportCases).set({ lastStaffMessageAt: new Date(Date.now() - 72 * 3_600_000) }).where(eq(supportCases.id, stale.id));
      await service.setStatus(ana, stale.id, 'waiting_customer');
      expect(await job.remindDue(new Date())).toBe(0);
      expect(await job.remindDue(new Date(Date.now() + 47 * 3_600_000))).toBe(0);
      expect(await job.remindDue(new Date(Date.now() + 49 * 3_600_000))).toBe(1);
      // Staff writing to the waiting customer restates the request: a new period, one more reminder later.
      await service.postStaffMessage(ana, stale.id, { body: 'Lembrando: precisamos do comprovante.' });
      expect(await job.remindDue(new Date(Date.now() + 47 * 3_600_000))).toBe(0);
      expect(await job.remindDue(new Date(Date.now() + 49 * 3_600_000))).toBe(1);

      // Closed cases are never reminded.
      const done = await service.createCase(bob, { category: 'other', message: 'x' });
      await service.resolve(ana, done.id, { reason: 'solved', explanation: 'ok' });
      await service.closeCase(ana, done.id);
      expect(await job.remindDue(new Date(Date.now() + 100 * 3_600_000))).toBe(0);
      view = await service.getStaffCase(done.id);
      expect(view.events.some((e) => e.type === 'reminder_sent')).toBe(false);
    });
  });

  describe('PH-9.1 case-domain debt (BL-013, BL-022, BL-029)', () => {
    it('a retried internal note is stored once, also under concurrent retries; keys are per author; a reply key cannot be replayed as a note', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      const input = { body: 'NOTA: conferir extrato', clientMessageId: 'note-1' };
      const first = await service.postInternalNote(ana, created.id, input);
      expect((await service.postInternalNote(ana, created.id, input)).id).toBe(first.id);
      const racing = await Promise.all([
        service.postInternalNote(ana, created.id, { body: 'Corrida', clientMessageId: 'note-2' }),
        service.postInternalNote(ana, created.id, { body: 'Corrida', clientMessageId: 'note-2' }),
      ]);
      expect(racing[0].id).toBe(racing[1].id);
      expect((await service.postInternalNote(bruno, created.id, input)).id).not.toBe(first.id); // another author's keys
      await service.postInternalNote(ana, created.id, { body: 'Sem chave' });
      await service.postInternalNote(ana, created.id, { body: 'Sem chave' }); // no key: two notes, as before
      const notes = (await service.getStaffCase(created.id)).messages.filter((m) => m.visibility === 'internal');
      expect(notes.map((n) => n.body)).toEqual(['NOTA: conferir extrato', 'Corrida', 'NOTA: conferir extrato', 'Sem chave', 'Sem chave']);
      await service.postStaffMessage(ana, created.id, { body: 'Resposta', clientMessageId: 'reply-1' });
      await expect(service.postInternalNote(ana, created.id, { body: 'x', clientMessageId: 'reply-1' })).rejects.toBeInstanceOf(ConflictException);
      expect(JSON.stringify(await service.getCustomerCase(alice, created.id))).not.toContain('NOTA');
    });

    it('a reminder is decided on the locked case: one that left waiting_customer meanwhile is not reminded, and only once per period', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      await service.setStatus(ana, created.id, 'waiting_customer');
      const now = new Date(Date.now() + 49 * 3_600_000);
      const cutoff = new Date(now.getTime() - 48 * 3_600_000);
      await service.postCustomerMessage(alice, created.id, { body: 'Voltei' }); // back to in_progress
      expect(await service.remind(created.id, cutoff, 48, now)).toBe(false);
      await service.setStatus(ana, created.id, 'waiting_customer');
      expect(await service.remind(created.id, new Date(now.getTime() + 1_000), 48, now)).toBe(true);
      expect(await service.remind(created.id, new Date(now.getTime() + 1_000), 48, now)).toBe(false);
      expect((await service.getStaffCase(created.id)).events.filter((e) => e.type === 'reminder_sent')).toHaveLength(1);
      await expect(service.remind(randomUUID(), cutoff, 48, now)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('supervision counts a case with an open consultation as waiting for a team after staff moved it on, and lists an overdue case once', async () => {
      const supervision = moduleRef.get(SupervisionService);
      const created = await service.createCase(alice, { category: 'other', message: 'Preciso da equipe' });
      const consultation = await service.requestConsultation(ana, created.id, { team: 'finance', question: 'Confere?' });
      await service.setStatus(ana, created.id, 'in_progress');
      expect((await service.getStaffCase(created.id)).status).toBe('in_progress');
      expect((await supervision.overview(carla)).waitingInternal.count).toBe(1);
      // Older than any threshold (max 720 h), and the customer also waits for a reply: two reasons, one entry.
      const requestedAt = new Date(Date.now() - 800 * 3_600_000);
      await db.update(caseConsultations).set({ requestedAt }).where(eq(caseConsultations.caseId, created.id));
      await db.update(supportCases).set({ lastCustomerMessageAt: new Date(Date.now() - 790 * 3_600_000) }).where(eq(supportCases.id, created.id));
      const overview = await supervision.overview(carla);
      expect(overview.waitingInternal).toEqual({ count: 1, oldestSince: requestedAt.toISOString() });
      expect(overview.overdue.filter((c) => c.id === created.id)).toHaveLength(1);
      await service.answerConsultation(bruno, created.id, consultation.id, { answer: 'Confere.' });
      expect((await supervision.overview(carla)).waitingInternal.count).toBe(0);
    });

    it('the SQL twin of awaitingReplySince agrees with the rule on every status', async () => {
      const fresh = await service.createCase(alice, { category: 'other', message: 'Novo' });
      const answered = await service.createCase(alice, { category: 'other', message: 'Respondido' });
      await service.postStaffMessage(ana, answered.id, { body: 'Olá' });
      const again = await service.createCase(bob, { category: 'other', message: 'Voltou' });
      await service.postStaffMessage(ana, again.id, { body: 'Olá' });
      await service.postCustomerMessage(bob, again.id, { body: 'Mais uma coisa' });
      const waiting = await service.createCase(bob, { category: 'other', message: 'Aguardando' });
      await service.setStatus(ana, waiting.id, 'waiting_customer');
      const team = await service.createCase(alice, { category: 'other', message: 'Equipe' });
      await service.setStatus(ana, team.id, 'waiting_internal');
      const done = await service.createCase(bob, { category: 'other', message: 'Feito' });
      await service.resolve(ana, done.id, { reason: 'solved', explanation: 'ok' });
      const closed = await service.createCase(alice, { category: 'other', message: 'Fechado' });
      await service.resolve(ana, closed.id, { reason: 'solved', explanation: 'ok' });
      await service.closeCase(ana, closed.id);
      const viaSql = new Map((await db.select({ id: supportCases.id, since: awaitingReplySinceSql }).from(supportCases)).map((r) => [r.id, r.since]));
      const rows = await db.select().from(supportCases);
      expect(rows).toHaveLength(7);
      const asTime = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string | Date).getTime());
      for (const row of rows) expect(asTime(viaSql.get(row.id))).toBe(awaitingReplySince(row)?.getTime() ?? null);
      expect(rows.filter((r) => awaitingReplySince(r) !== null).map((r) => r.id).sort()).toEqual([fresh.id, again.id, team.id].sort());
    });
  });


  describe('uploads never linked (PH-9.4, BL-009)', () => {
    it('removes them after the grace period — staged or on a case — with their bytes, and keeps linked or recent ones', async () => {
      const attachments = moduleRef.get(AttachmentsService);
      const storage = moduleRef.get<AttachmentStorage>(ATTACHMENT_STORAGE);
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('bytes')]);
      const file = (name: string) => ({ originalname: name, mimetype: 'image/png', size: png.length, buffer: png });
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      const row = await service.requireOwnCaseRow(alice, created.id);
      const abandoned = await attachments.upload(alice, row, file('abandonado.png'));
      const staged = await attachments.uploadStaged(alice, file('staged.png'));
      const kept = await attachments.upload(alice, row, file('enviado.png'));
      await service.postCustomerMessage(alice, created.id, { body: 'Segue', attachmentIds: [kept.id] });
      const recent = await attachments.uploadStaged(alice, file('recente.png'));
      const ids = [abandoned.id, staged.id, kept.id, recent.id];
      await db.update(caseAttachments).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).where(inArray(caseAttachments.id, [abandoned.id, staged.id, kept.id]));
      const keys = await db.select({ id: caseAttachments.id, key: caseAttachments.storageKey }).from(caseAttachments).where(inArray(caseAttachments.id, ids));
      expect(await attachments.removeUnlinked(new Date(), 24)).toBe(2);
      const left = (await db.select({ id: caseAttachments.id }).from(caseAttachments).where(inArray(caseAttachments.id, ids))).map((r) => r.id).sort();
      expect(left).toEqual([kept.id, recent.id].sort());
      for (const { id, key } of keys) {
        if (id === abandoned.id || id === staged.id) await expect(storage.get(key)).rejects.toThrow();
        else expect(await storage.get(key)).toBeInstanceOf(Buffer);
      }
      expect(await attachments.removeUnlinked(new Date(), 24)).toBe(0);
      await db.delete(caseAttachments).where(inArray(caseAttachments.id, [recent.id])); // staged rows outlive the case cleanup of beforeEach
    });
  });

  describe('Cycle Audit 3 remediation (FND-0082, FND-0084, FND-0085, FND-0086)', () => {
    it('a note key replayed as a public reply is refused, never answered with the note (FND-0082)', async () => {
      const created = await service.createCase(alice, { category: 'other', message: 'Oi' });
      await service.postInternalNote(ana, created.id, { body: 'NOTA secreta', clientMessageId: 'k-note' });
      await expect(service.postStaffMessage(ana, created.id, { body: 'Resposta', clientMessageId: 'k-note' })).rejects.toBeInstanceOf(ConflictException);
      expect((await service.getCustomerCase(alice, created.id)).messages.map((m) => m.body)).toEqual(['Oi']);
    });

    it('the waiting-for-team view, its order and the summaries follow the rule supervision counts by (FND-0084)', async () => {
      const moved = await service.createCase(alice, { category: 'other', message: 'Consulta aberta' });
      await service.requestConsultation(ana, moved.id, { team: 'finance', question: '?' });
      await service.setStatus(ana, moved.id, 'in_progress');
      await db.update(caseConsultations).set({ requestedAt: new Date(Date.now() - 5 * 3_600_000) }).where(eq(caseConsultations.caseId, moved.id));
      const plain = await service.createCase(bob, { category: 'other', message: 'Equipe' });
      await service.setStatus(ana, plain.id, 'waiting_internal');
      const none = await service.createCase(bob, { category: 'other', message: 'Nada' });
      const queue = await service.listStaffCases(ana, 'waiting_internal');
      expect(queue.map((c) => c.id)).toEqual([moved.id, plain.id]); // the oldest wait first
      expect(queue[0]).toMatchObject({ status: 'in_progress', waitingInternalSince: expect.any(String) });
      expect((await service.getStaffCase(none.id)).waitingInternalSince).toBeNull();
      expect((await moduleRef.get(SupervisionService).overview(carla)).waitingInternal.count).toBe(queue.length);
      const viaSql = new Map((await db.select({ id: supportCases.id, since: waitingInternalSinceSql }).from(supportCases)).map((r) => [r.id, r.since]));
      const open = await db.select().from(caseConsultations).where(eq(caseConsultations.status, 'open'));
      const oldest = (id: string) => open.filter((c) => c.caseId === id).map((c) => c.requestedAt).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      const asTime = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string | Date).getTime());
      for (const row of await db.select().from(supportCases)) expect(asTime(viaSql.get(row.id))).toBe(waitingInternalSince(row, oldest(row.id))?.getTime() ?? null);
    });

    it('the cleanup removes every stale upload in one run, batch after batch (FND-0085)', async () => {
      const attachments = moduleRef.get(AttachmentsService);
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('lote')]);
      const created = await service.createCase(bob, { category: 'other', message: 'Oi' });
      const row = await service.requireOwnCaseRow(bob, created.id);
      const ids: string[] = [];
      for (let i = 0; i < 5; i += 1) ids.push((await attachments.upload(bob, row, { originalname: `f${i}.png`, mimetype: 'image/png', size: png.length, buffer: png })).id);
      await db.update(caseAttachments).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).where(inArray(caseAttachments.id, ids));
      expect(await attachments.removeUnlinked(new Date(), 24, 2)).toBe(5);
    });

    it('a file the cleanup removed fails the send and the creation instead of vanishing from them (FND-0086)', async () => {
      const attachments = moduleRef.get(AttachmentsService);
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('limpo')]);
      const file = (name: string) => ({ originalname: name, mimetype: 'image/png', size: png.length, buffer: png });
      const created = await service.createCase(bob, { category: 'other', message: 'Oi' });
      const onCase = await attachments.upload(bob, await service.requireOwnCaseRow(bob, created.id), file('caso.png'));
      const staged = await attachments.uploadStaged(bob, file('staged.png'));
      await db.update(caseAttachments).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).where(inArray(caseAttachments.id, [onCase.id, staged.id]));
      expect(await attachments.removeUnlinked(new Date(), 24)).toBeGreaterThanOrEqual(2);
      await expect(service.postCustomerMessage(bob, created.id, { body: 'Segue', attachmentIds: [onCase.id] })).rejects.toBeInstanceOf(BadRequestException);
      const before = (await service.listCustomerCases(bob)).length;
      await expect(service.createCase(bob, { category: 'other', message: 'Com anexo', attachmentIds: [staged.id] })).rejects.toBeInstanceOf(BadRequestException);
      expect((await service.listCustomerCases(bob)).length).toBe(before);
    });

    it.runIf(Boolean(process.env.SUPPORT_DATABASE_URL))('on PostgreSQL, a cleanup that meets a link in progress leaves the linked file (FND-0086)', async () => {
      const attachments = moduleRef.get(AttachmentsService);
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('corrida')]);
      const created = await service.createCase(bob, { category: 'other', message: 'Oi' });
      const upload = await attachments.upload(bob, await service.requireOwnCaseRow(bob, created.id), { originalname: 'corrida.png', mimetype: 'image/png', size: png.length, buffer: png });
      await db.update(caseAttachments).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).where(eq(caseAttachments.id, upload.id));
      const messageId = (await service.getStaffCase(created.id)).messages[0].id;
      let release!: () => void;
      const hold = new Promise<void>((resolve) => (release = resolve));
      const linking = db.transaction(async (tx) => {
        await attachments.linkToMessage(tx, bob, created.id, messageId, [upload.id]);
        await hold; // the link holds the row lock while the cleanup runs
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const cleaning = attachments.removeUnlinked(new Date(), 24);
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await linking;
      await cleaning;
      const [kept] = await db.select().from(caseAttachments).where(eq(caseAttachments.id, upload.id));
      expect(kept?.messageId).toBe(messageId);
    });
  });

  describe('formal complaints (PH-10.2, DEC-0039 g)', () => {
    it('a complaint chosen by the customer gets a 5-business-day deadline in the operation\'s zone, staff-only; a follow-up inherits it', async () => {
      const created = await service.createCase(alice, { category: 'formal_complaint', message: 'Quero registrar uma reclamação formal.' });
      const view = await service.getStaffCase(created.id);
      expect(view.category).toBe('formal_complaint');
      const deadline = new Date(view.complaintDeadlineAt!);
      const days = (deadline.getTime() - new Date(view.createdAt).getTime()) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(5);
      expect(days).toBeLessThanOrEqual(9);
      expect('complaintDeadlineAt' in (await service.getCustomerCase(alice, created.id))).toBe(false);
      await service.resolve(carla, created.id, { reason: 'solved', explanation: 'Respondida.' });
      await service.closeCase(carla, created.id);
      const child = await service.createFollowUp(alice, created.id, { message: 'Ainda não concordo.' });
      expect((await service.getStaffCase(child.id))).toMatchObject({ category: 'formal_complaint', complaintDeadlineAt: expect.any(String) });
    });

    it('an agent can neither take nor work a complaint; a supervisor can; reclassification starts or ends the deadline', async () => {
      const created = await service.createCase(alice, { category: 'formal_complaint', message: 'Reclamação.' });
      for (const attempt of [
        () => service.takeCase(ana, created.id),
        () => service.postStaffMessage(ana, created.id, { body: 'Olá' }),
        () => service.postInternalNote(ana, created.id, { body: 'nota' }),
        () => service.setStatus(ana, created.id, 'waiting_customer'),
        () => service.updateAttributes(ana, created.id, { priority: 'high' }),
        () => service.requestConsultation(ana, created.id, { team: 'finance', question: '?' }),
      ]) {
        const error = await attempt().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe('supervisor_required');
      }
      expect((await service.getStaffCase(created.id)).assignedAgentId).toBeNull();
      await service.takeCase(carla, created.id);
      await service.postStaffMessage(carla, created.id, { body: 'Recebemos sua reclamação.' });
      // A supervisor may ask a specialist team, and the specialist (an agent) may answer.
      const consultation = await service.requestConsultation(carla, created.id, { team: 'finance', question: 'Houve cobrança indevida?' });
      await service.answerConsultation(ana, created.id, consultation.id, { answer: 'Não.' });
      // Handing it to an agent is refused; to an admin/supervisor it is not.
      await expect(service.assignCase(carla, created.id, { agentId: ana.id })).rejects.toBeInstanceOf(BadRequestException);
      // Reclassified away: the deadline ends and agents may work it again.
      await service.updateAttributes(carla, created.id, { category: 'other' });
      expect((await service.getStaffCase(created.id)).complaintDeadlineAt).toBeNull();
      await service.postInternalNote(ana, created.id, { body: 'agora posso' });
      // Reclassified into a complaint by staff: a fresh deadline.
      const plain = await service.createCase(bob, { category: 'other', message: 'Oi' });
      expect((await service.getStaffCase(plain.id)).complaintDeadlineAt).toBeNull();
      await service.updateAttributes(carla, plain.id, { category: 'formal_complaint' });
      expect((await service.getStaffCase(plain.id)).complaintDeadlineAt).toEqual(expect.any(String));
    });

    it('closing audit FND-0106/0107: an agent-owned case that becomes a complaint is released to a supervisor; incident notes and the read marker respect the rule', async () => {
      const owned = await service.createCase(bob, { category: 'other', message: 'Oi' });
      await service.takeCase(ana, owned.id);
      await service.updateAttributes(ana, owned.id, { category: 'formal_complaint' });
      const view = await service.getStaffCase(owned.id);
      expect(view.assignedAgentId).toBeNull();
      expect(view.events.at(-2)).toMatchObject({ type: 'case_assigned', actorId: ana.id, data: { agentId: null, previousAgentId: ana.id, released: true, reason: 'formal_complaint' } });
      expect(view.events.at(-1)).toMatchObject({ type: 'category_changed', data: { to: 'formal_complaint' } });
      // A supervisor keeps an owner who may work complaints.
      const kept = await service.createCase(bob, { category: 'other', message: 'Oi de novo' });
      await service.takeCase(carla, kept.id);
      await service.updateAttributes(carla, kept.id, { category: 'formal_complaint' });
      expect((await service.getStaffCase(kept.id)).assignedAgentId).toBe(carla.id);
      // An incident note from an agent skips the linked complaint; a supervisor's reaches it. The agent cannot move its read marker.
      const incident = await service.createIncident(carla, { title: 'Provedor fora do ar' });
      await service.linkIncident(carla, owned.id, incident.id);
      expect(await service.broadcastIncidentNote(ana, incident.id, { body: 'Normalizado.' })).toEqual({ delivered: 0, skippedComplaints: 1 });
      expect(await service.broadcastIncidentNote(carla, incident.id, { body: 'Normalizado.' })).toEqual({ delivered: 1, skippedComplaints: 0 });
      expect((await service.getStaffCase(owned.id)).messages.filter((m) => m.visibility === 'internal').map((m) => m.authorId)).toEqual([carla.id]);
      await expect(service.markStaffRead(ana, owned.id)).rejects.toBeInstanceOf(ForbiddenException);
      await service.markStaffRead(carla, owned.id);
    });

    it('supervision lists open complaints by deadline and counts the ones past it', async () => {
      const supervision = moduleRef.get(SupervisionService);
      const late = await service.createCase(alice, { category: 'formal_complaint', message: 'Atrasada.' });
      const fresh = await service.createCase(bob, { category: 'formal_complaint', message: 'Recente.' });
      await db.update(supportCases).set({ complaintDeadlineAt: new Date(Date.now() - 3_600_000) }).where(eq(supportCases.id, late.id));
      const overview = await supervision.overview(carla);
      expect(overview.complaints.count).toBe(2);
      expect(overview.complaints.overdue).toBe(1);
      expect(overview.complaints.list.map((c) => c.id)).toEqual([late.id, fresh.id]);
      await service.resolve(carla, late.id, { reason: 'solved', explanation: 'ok' });
      expect((await supervision.overview(carla)).complaints).toMatchObject({ count: 1, overdue: 0 });
    });
  });

  describe('exports of a customer\'s data (PH-10.3, DEC-0039 h)', () => {
    it('an administrator exports only what the customer can see and the export is recorded; others are refused', async () => {
      const exports = moduleRef.get(DataExportService);
      const dani: StaffActor = { kind: 'staff', id: 'staff-dani', role: 'admin', displayName: 'Dani', source: 'simulated' };
      const created = await service.createCase(alice, { category: 'other', message: 'Quero meus dados.' });
      await service.postStaffMessage(ana, created.id, { body: 'Claro.' });
      await service.postInternalNote(ana, created.id, { body: 'NOTA INTERNA' });
      await service.requestConsultation(ana, created.id, { team: 'finance', question: 'PERGUNTA INTERNA' });
      await service.createCase(bob, { category: 'other', message: 'Caso do Bob' });
      await expect(exports.exportCustomer(carla, alice.id, { reason: 'Pedido do cliente.' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(exports.exportCustomer(ana, alice.id, { reason: 'Pedido do cliente.' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(exports.exportCustomer(dani, 'not valid!', { reason: 'Pedido do cliente.' })).rejects.toBeInstanceOf(BadRequestException);
      const result = await exports.exportCustomer(dani, alice.id, { reason: 'Pedido do cliente.' });
      expect(result.record).toMatchObject({ customerId: alice.id, requestedById: dani.id, reason: 'Pedido do cliente.', caseCount: 1 });
      expect(result.cases.map((c) => c.id)).toEqual([created.id]);
      expect(result.cases[0].messages.map((m) => m.body)).toEqual(['Quero meus dados.', 'Claro.']);
      expect(result.cases[0].events.map((e) => e.type)).toContain('case_created');
      const text = JSON.stringify(result);
      expect(text).not.toContain('NOTA INTERNA');
      expect(text).not.toContain('PERGUNTA INTERNA');
      expect(text).not.toContain('Caso do Bob');
      expect(typeof result.preferences.emailNotifications).toBe('boolean'); // whatever the customer chose (an earlier test opted Alice out)
      const list = await exports.list(dani);
      expect(list[0].id).toBe(result.record.id);
      await expect(exports.list(carla)).rejects.toBeInstanceOf(ForbiddenException);
      // A customer with no cases exports an empty, still recorded, set.
      const empty = await exports.exportCustomer(dani, 'cust-nobody', { reason: 'Pedido do cliente.' });
      expect(empty).toMatchObject({ cases: [], record: { caseCount: 0 } });
      expect(empty.preferences).toEqual({ emailNotifications: true, updatedAt: null }); // never set: the default
    });
  });

  describe('e-mail dead letters (PH-12.1, BL-028)', () => {
    it('a send that keeps failing is retried up to the limit, then parked with the notification kept in the product', async () => {
      const job = moduleRef.get(NotificationJob);
      const notifier = moduleRef.get<EmailNotifierPort>(EMAIL_NOTIFIER);
      const notifications = moduleRef.get(NotificationsService);
      const carlos: CustomerActor = { kind: 'customer', id: 'cust-bruno', source: 'simulated' }; // known to the simulated Orbit (its address exists)
      const created = await service.createCase(carlos, { category: 'other', message: 'Oi' });
      await service.postStaffMessage(ana, created.id, { body: 'Olá' });
      const failing = vi.spyOn(notifier, 'send').mockRejectedValue(new Error('provider down'));
      try {
        const later = new Date(Date.now() + 60 * 60_000);
        for (let i = 1; i <= 5; i += 1) {
          expect(await job.emailDue(later)).toBe(0);
          const [row] = await db.select().from(caseNotifications).where(eq(caseNotifications.caseId, created.id));
          expect(row.emailAttempts).toBe(i);
          expect(row.emailedAt).toBeNull();
          expect(row.emailFailedAt === null).toBe(i < 5);
        }
        expect(failing).toHaveBeenCalledTimes(5);
        expect(await job.emailDue(later)).toBe(0); // a dead letter is not retried
        expect(failing).toHaveBeenCalledTimes(5);
      } finally {
        failing.mockRestore();
      }
      expect(await job.emailDue(new Date(Date.now() + 60 * 60_000))).toBe(0); // still parked once the provider is back
      expect((await notifications.list(carlos)).map((n) => n.kind)).toEqual(['staff_reply']); // the in-product notification stays
      expect(await job.outbox(carlos)).toHaveLength(0);
    });
  });
});
