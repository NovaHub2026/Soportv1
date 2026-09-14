import { createHash } from 'node:crypto';
import { ConflictException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, gt } from 'drizzle-orm';
import {
  ACCESS_RECOVERY_LIMITS,
  type AccessRecoveryInput,
  type AccessRecoveryOutcomeInput,
  type AccessRecoveryReceipt,
  type AccessRecoveryRequest,
  type AccessRecoveryStatus,
  formatRecoveryReference,
  normalizeContact,
} from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { type AccessRecoveryRow, accessRecoveryRequests } from '../database/schema.js';
import type { StaffActor } from '../identity/identity.types.js';

const HOUR_MS = 3_600_000;
const BURST_WINDOW_MS = 10 * 60_000;

/**
 * "Não consigo acessar minha conta" (PH-7.1, context §4.5, §14 item 8). This service knows nothing about cases,
 * customers or Orbit records on purpose: a recovery request is an unverified contact plus a description, and
 * the answer is the same whether or not the contact belongs to an account (RULE-SUP-01). Abuse limits are
 * working defaults (ACCESS_RECOVERY_LIMITS): per contact (normalized — Cycle Audit 3) with 429 `too_many_requests`,
 * and an instance-wide ceiling with 429 `service_busy` so the page never blames a person's own contact for
 * other people's traffic. The "forwarded" outcome records a hand-off to Orbit's verification process that is
 * simulated until one exists (DEC-0003, BL-002).
 */
@Injectable()
export class AccessRecoveryService {
  /** Instance-wide burst window (timestamps of accepted requests in the last 10 minutes). */
  private readonly accepted: number[] = [];

  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: AccessRecoveryInput, now = new Date()): Promise<AccessRecoveryReceipt> {
    const contactHash = hashContact(input.contact);
    if (input.clientRequestId) {
      const existing = await this.findByClientRequest(contactHash, input.clientRequestId);
      if (existing) return toReceipt(existing);
    }
    this.assertBurst(now);
    const [{ recent }] = await this.db
      .select({ recent: count() })
      .from(accessRecoveryRequests)
      .where(and(eq(accessRecoveryRequests.contactHash, contactHash), gt(accessRecoveryRequests.createdAt, new Date(now.getTime() - HOUR_MS))));
    if (Number(recent) >= ACCESS_RECOVERY_LIMITS.perContactPerHour) throw tooMany('too_many_requests', HOUR_MS / 1000);
    try {
      const [row] = await this.db
        .insert(accessRecoveryRequests)
        .values({ contact: input.contact, contactHash, description: input.description, clientRequestId: input.clientRequestId ?? null, createdAt: now })
        .returning();
      this.accepted.push(now.getTime());
      return toReceipt(row);
    } catch (error) {
      // Two retries raced past the lookup: the unique index kept one; answer with it (RULE-SUP-03).
      if (input.clientRequestId) {
        const existing = await this.findByClientRequest(contactHash, input.clientRequestId);
        if (existing) return toReceipt(existing);
      }
      throw error;
    }
  }

  async list(status?: AccessRecoveryStatus, limit = 100): Promise<AccessRecoveryRequest[]> {
    const rows = await this.db
      .select()
      .from(accessRecoveryRequests)
      .where(status ? eq(accessRecoveryRequests.status, status) : undefined)
      .orderBy(desc(accessRecoveryRequests.createdAt))
      .limit(limit);
    return rows.map(toRequest);
  }

  /** One attributable outcome per request: forwarded to Orbit's verification process (simulated) or closed. */
  async handle(staff: StaffActor, id: string, input: AccessRecoveryOutcomeInput, now = new Date()): Promise<AccessRecoveryRequest> {
    const [row] = await this.db.select().from(accessRecoveryRequests).where(eq(accessRecoveryRequests.id, id)).limit(1);
    if (!row) throw new NotFoundException('recovery_request_not_found');
    if (row.status !== 'received') throw new ConflictException('recovery_request_already_handled');
    const [changed] = await this.db
      .update(accessRecoveryRequests)
      .set({ status: input.outcome, note: input.note ?? null, handledById: staff.id, handledByName: staff.displayName, handledAt: now })
      .where(and(eq(accessRecoveryRequests.id, id), eq(accessRecoveryRequests.status, 'received')))
      .returning();
    if (!changed) throw new ConflictException('recovery_request_already_handled');
    return toRequest(changed);
  }

  private async findByClientRequest(contactHash: string, clientRequestId: string): Promise<AccessRecoveryRow | undefined> {
    const [row] = await this.db
      .select()
      .from(accessRecoveryRequests)
      .where(and(eq(accessRecoveryRequests.contactHash, contactHash), eq(accessRecoveryRequests.clientRequestId, clientRequestId)))
      .limit(1);
    return row;
  }

  private assertBurst(now: Date): void {
    const floor = now.getTime() - BURST_WINDOW_MS;
    while (this.accepted.length > 0 && this.accepted[0] < floor) this.accepted.shift();
    if (this.accepted.length >= ACCESS_RECOVERY_LIMITS.perInstancePer10Minutes) {
      throw tooMany('service_busy', Math.ceil((this.accepted[0] + BURST_WINDOW_MS - now.getTime()) / 1000));
    }
  }
}

function tooMany(error: 'too_many_requests' | 'service_busy', retryAfterSeconds: number): HttpException {
  return new HttpException({ error, retryAfterSeconds: Math.max(1, retryAfterSeconds) }, 429);
}

/** sha256 of the normalized contact: the limit and the idempotency key, without indexing the raw value. */
export function hashContact(contact: string): string {
  return createHash('sha256').update(normalizeContact(contact)).digest('hex');
}

function toReceipt(row: AccessRecoveryRow): AccessRecoveryReceipt {
  return { reference: formatRecoveryReference(row.referenceNumber), receivedAt: row.createdAt.toISOString(), nextStep: 'orbit_verification', delivery: 'simulated' };
}

function toRequest(row: AccessRecoveryRow): AccessRecoveryRequest {
  return {
    id: row.id,
    reference: formatRecoveryReference(row.referenceNumber),
    contact: row.contact,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    handledById: row.handledById,
    handledByName: row.handledByName,
    handledAt: row.handledAt ? row.handledAt.toISOString() : null,
    note: row.note,
  };
}
