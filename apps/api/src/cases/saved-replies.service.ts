import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { SavedReply, SavedReplyInput } from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { type SavedReplyRow, savedReplies } from '../database/schema.js';
import type { StaffActor } from '../identity/identity.types.js';

/**
 * Saved replies (PH-5.3, context §5.2/§5.4): shared templates the team maintains. Any staff member may create
 * one; editing or removing someone else's needs a supervisor or admin (RULE-SUP-09: every change is attributed).
 */
@Injectable()
export class SavedRepliesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(): Promise<SavedReply[]> {
    const rows = await this.db.select().from(savedReplies).orderBy(asc(savedReplies.title));
    return rows.map(toSavedReply);
  }

  async create(staff: StaffActor, input: SavedReplyInput): Promise<SavedReply> {
    const now = new Date();
    const [row] = await this.db
      .insert(savedReplies)
      .values({
        title: input.title,
        body: input.body,
        category: input.category ?? null,
        createdById: staff.id,
        createdByName: staff.displayName,
        updatedById: staff.id,
        updatedByName: staff.displayName,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toSavedReply(row);
  }

  async update(staff: StaffActor, id: string, input: SavedReplyInput): Promise<SavedReply> {
    const existing = await this.require(id);
    this.assertMayEdit(existing, staff);
    const [row] = await this.db
      .update(savedReplies)
      .set({ title: input.title, body: input.body, category: input.category ?? null, updatedById: staff.id, updatedByName: staff.displayName, updatedAt: new Date() })
      .where(eq(savedReplies.id, existing.id))
      .returning();
    return toSavedReply(row);
  }

  async remove(staff: StaffActor, id: string): Promise<void> {
    const existing = await this.require(id);
    this.assertMayEdit(existing, staff);
    await this.db.delete(savedReplies).where(eq(savedReplies.id, existing.id));
  }

  private async require(id: string): Promise<SavedReplyRow> {
    const [row] = await this.db.select().from(savedReplies).where(eq(savedReplies.id, id)).limit(1);
    if (!row) throw new NotFoundException('saved_reply_not_found');
    return row;
  }

  private assertMayEdit(row: SavedReplyRow, staff: StaffActor): void {
    if (row.createdById !== staff.id && staff.role === 'agent') throw new ForbiddenException('not_reply_author');
  }
}

function toSavedReply(row: SavedReplyRow): SavedReply {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: (row.category as SavedReply['category']) ?? null,
    createdById: row.createdById,
    createdByName: row.createdByName,
    updatedById: row.updatedById,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
