import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import type { Db } from '../database/database.js';
import type { CaseStreamEvent } from '@orbit-support/shared';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { DatabaseModule, DB } from '../database/database.module.js';
import { caseMessages, supportCases } from '../database/schema.js';
import { CaseEventBus } from '../events/case-event-bus.js';
import type { CustomerActor, StaffActor } from '../identity/identity.types.js';
import { CasesService } from './cases.service.js';

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
      providers: [CasesService, CaseEventBus],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(CasesService);
    db = moduleRef.get(DB);
    moduleRef.get(CaseEventBus).events$.subscribe((event) => published.push(event));
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

      await service.markStaffRead(created.id);
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
      expect(detail.assignedAgentId).toBeNull();
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
      expect(customerView.assignedAgentId).toBe(ana.id);
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
});
