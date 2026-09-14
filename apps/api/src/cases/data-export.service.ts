import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { type CustomerDataExport, type DataExportRecord, type DataExportRequestInput } from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { type DataExportRow, dataExports, supportCases } from '../database/schema.js';
import type { CustomerActor, StaffActor } from '../identity/identity.types.js';
import { CasesService } from './cases.service.js';
import { NotificationJob } from './notification.job.js';

const CUSTOMER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Exports of one customer's support data on the customer's request (PH-10.3, DEC-0039 h): an administrator only,
 * recorded with who asked and why (RULE-SUP-09). The export holds what the customer could see (their cases, public
 * messages with attachment metadata, the attributable history, their preferences) — never internal notes,
 * consultations or another customer's data (RULE-SUP-01, RULE-SUP-04).
 */
@Injectable()
export class DataExportService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cases: CasesService,
    private readonly notifications: NotificationJob,
  ) {}

  async exportCustomer(staff: StaffActor, customerId: string, input: DataExportRequestInput): Promise<CustomerDataExport> {
    this.assertAdmin(staff);
    if (!CUSTOMER_ID.test(customerId)) throw new BadRequestException({ error: 'invalid_customer_id' });
    const customer: CustomerActor = { kind: 'customer', id: customerId, source: 'simulated' };
    const rows = await this.db.select().from(supportCases).where(eq(supportCases.customerId, customerId)).orderBy(desc(supportCases.createdAt));
    const cases = await Promise.all(rows.map((row) => this.cases.exportCase(customer, row)));
    const preferences = await this.notifications.preferences(customer);
    const [record] = await this.db
      .insert(dataExports)
      .values({ customerId, requestedById: staff.id, requestedByName: staff.displayName, reason: input.reason, caseCount: cases.length })
      .returning();
    return { record: toRecord(record), customerId, preferences, cases };
  }

  async list(staff: StaffActor, limit = 50): Promise<DataExportRecord[]> {
    this.assertAdmin(staff);
    const rows = await this.db.select().from(dataExports).orderBy(desc(dataExports.createdAt)).limit(limit);
    return rows.map(toRecord);
  }

  private assertAdmin(staff: StaffActor): void {
    if (staff.role !== 'admin') throw new ForbiddenException('admin_required');
  }
}

function toRecord(row: DataExportRow): DataExportRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    requestedById: row.requestedById,
    requestedByName: row.requestedByName,
    reason: row.reason,
    caseCount: row.caseCount,
    createdAt: row.createdAt.toISOString(),
  };
}
