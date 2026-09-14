import { ConflictException, HttpException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseModule } from '../database/database.module.js';
import { DB } from '../database/database.module.js';
import type { Db } from '../database/database.js';
import { accessRecoveryRequests } from '../database/schema.js';
import type { StaffActor } from '../identity/identity.types.js';
import { AccessRecoveryService } from './access-recovery.service.js';

const ana: StaffActor = { kind: 'staff', id: 'staff-ana', role: 'agent', displayName: 'Ana', source: 'simulated' };

describe('AccessRecoveryService (PH-7.1, §4.5)', () => {
  let moduleRef: TestingModule;
  let service: AccessRecoveryService;
  let db: Db;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [DatabaseModule.forRoot({ inMemory: true })], providers: [AccessRecoveryService] }).compile();
    await moduleRef.init();
    service = moduleRef.get(AccessRecoveryService);
    db = moduleRef.get(DB);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await db.delete(accessRecoveryRequests);
  });

  it('answers with a reference and the next step only, the same for a retried request', async () => {
    const first = await service.create({ contact: 'alice@example.com', description: 'Não recebo o código de verificação.', clientRequestId: 'r-1' });
    expect(first).toEqual({ reference: expect.stringMatching(/^REC-[0-9]{6}$/), receivedAt: expect.any(String), nextStep: 'orbit_verification', delivery: 'simulated' });
    const again = await service.create({ contact: 'Alice@Example.com ', description: 'Não recebo o código de verificação.', clientRequestId: 'r-1' });
    expect(again.reference).toBe(first.reference);
    expect(Object.keys(first).sort()).toEqual(['delivery', 'nextStep', 'receivedAt', 'reference']);
    // The same client id from another contact is another request (the key is per contact).
    const other = await service.create({ contact: 'bob@example.com', description: 'Perdi o acesso ao e-mail cadastrado.', clientRequestId: 'r-1' });
    expect(other.reference).not.toBe(first.reference);
  });

  it('bounds repeated requests per contact per hour and answers 429 with a retry hint', async () => {
    for (let i = 0; i < 3; i += 1) await service.create({ contact: '+55 11 99999-1234', description: `Tentativa número ${i} de recuperar.` });
    await expect(service.create({ contact: '+55 11 99999-1234', description: 'Mais uma tentativa de recuperar.' })).rejects.toBeInstanceOf(HttpException);
    // Cycle Audit 3: reformatting the same phone does not reset the limit.
    await expect(service.create({ contact: '+55 (11) 99999 1234', description: 'Mesmo telefone, outro formato.' })).rejects.toBeInstanceOf(HttpException);
    try {
      await service.create({ contact: '+55 11 99999-1234', description: 'Mais uma tentativa de recuperar.' });
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({ error: 'too_many_requests', retryAfterSeconds: expect.any(Number) });
    }
    // An hour later the contact may ask again.
    const later = await service.create({ contact: '+55 11 99999-1234', description: 'Mais uma tentativa de recuperar.' }, new Date(Date.now() + 61 * 60_000));
    expect(later.reference).toMatch(/^REC-[0-9]{6}$/); // the identity sequence is not reset between tests
  });

  it('lists by status and records one attributable outcome per request', async () => {
    await service.create({ contact: 'carla@example.com', description: 'Meu telefone cadastrado mudou.' });
    const [received] = await service.list('received');
    expect(received).toMatchObject({ reference: expect.stringMatching(/^REC-[0-9]{6}$/), contact: 'carla@example.com', status: 'received', handledById: null });
    const forwarded = await service.handle(ana, received.id, { outcome: 'forwarded', note: 'Encaminhado ao processo de verificação.' });
    expect(forwarded).toMatchObject({ status: 'forwarded', handledById: 'staff-ana', handledByName: 'Ana', note: 'Encaminhado ao processo de verificação.' });
    expect(forwarded.handledAt).not.toBeNull();
    await expect(service.handle(ana, received.id, { outcome: 'closed' })).rejects.toBeInstanceOf(ConflictException);
    expect(await service.list('received')).toHaveLength(0);
    expect((await service.list()).map((r) => r.status)).toEqual(['forwarded']);
  });
});
