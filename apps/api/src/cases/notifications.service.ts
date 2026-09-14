import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type CustomerNotification, formatCaseReference, type NotificationKind } from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { type CaseNotificationRow, caseNotifications, supportCases } from '../database/schema.js';
import type { CustomerActor } from '../identity/identity.types.js';

/**
 * In-product notifications for customers (PH-6.1, context §4.4). Rows are written by `CasesService` inside the
 * transaction of the change that caused them, so a notification exists exactly once per event (RULE-SUP-03) and
 * never for internal work (RULE-SUP-04). Reading and marking are ownership-scoped (RULE-SUP-01).
 */
@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Insert helper for `CasesService` transactions. */
  async record(tx: Db, customerId: string, caseId: string, kind: NotificationKind, now: Date): Promise<void> {
    await tx.insert(caseNotifications).values({ customerId, caseId, kind, createdAt: now });
  }

  async list(customer: CustomerActor, limit = 20): Promise<CustomerNotification[]> {
    const rows = await this.db
      .select({ n: caseNotifications, referenceNumber: supportCases.referenceNumber })
      .from(caseNotifications)
      .innerJoin(supportCases, eq(supportCases.id, caseNotifications.caseId))
      .where(eq(caseNotifications.customerId, customer.id))
      .orderBy(sql`${caseNotifications.readAt} is not null`, desc(caseNotifications.createdAt))
      .limit(limit);
    return rows.map(({ n, referenceNumber }) => toNotification(n, referenceNumber));
  }

  async unreadCount(customer: CustomerActor): Promise<number> {
    const [{ n }] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(caseNotifications)
      .where(and(eq(caseNotifications.customerId, customer.id), isNull(caseNotifications.readAt)));
    return Number(n);
  }

  /** Marks the given ids, or every unread one of the case, or everything, as read — own rows only. */
  async markRead(customer: CustomerActor, scope: { ids?: string[]; caseId?: string }): Promise<number> {
    const conditions = [eq(caseNotifications.customerId, customer.id), isNull(caseNotifications.readAt)];
    if (scope.ids && scope.ids.length > 0) conditions.push(inArray(caseNotifications.id, scope.ids));
    if (scope.caseId) conditions.push(eq(caseNotifications.caseId, scope.caseId));
    const updated = await this.db
      .update(caseNotifications)
      .set({ readAt: new Date() })
      .where(and(...conditions))
      .returning({ id: caseNotifications.id });
    return updated.length;
  }
}

function toNotification(row: CaseNotificationRow, referenceNumber: number): CustomerNotification {
  return {
    id: row.id,
    caseId: row.caseId,
    caseReference: formatCaseReference(referenceNumber),
    kind: row.kind as NotificationKind,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}
