import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, lt, min } from 'drizzle-orm';
import {
  type AgentLoad,
  CASE_STATUSES,
  type CaseStatus,
  durationStats,
  OPEN_CASE_STATUSES,
  type ServiceMetrics,
  type SupervisionOverview,
} from '@orbit-support/shared';
import type { Db } from '../database/database.js';
import { DB } from '../database/database.module.js';
import { caseConsultations, caseEvents, caseMessages, supportCases } from '../database/schema.js';
import type { StaffActor } from '../identity/identity.types.js';
import { awaitingReplySince, waitingInternalSince } from './case-rules.js';
import { CasesService } from './cases.service.js';
import { SettingsService } from './settings.service.js';

const OPEN = [...OPEN_CASE_STATUSES];

/**
 * Supervision (PH-5.4, context §5.4): outstanding demand and outcomes computed from the case table and the
 * attributable history. Supervisors and admins only (provisional gating by the simulated role until PH-7).
 * Metrics describe what happened; no target exists until Operations defines one (§13.2, BL-002).
 */
@Injectable()
export class SupervisionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cases: CasesService,
    private readonly settings: SettingsService,
  ) {}

  assertSupervisor(staff: StaffActor): void {
    if (staff.role === 'agent') throw new ForbiddenException('supervisor_required');
  }

  async overview(staff: StaffActor, now = new Date()): Promise<SupervisionOverview> {
    this.assertSupervisor(staff);
    const thresholdHours = await this.settings.attentionThresholdHours();
    const rows = await this.db.select().from(supportCases);
    const byStatus = Object.fromEntries(CASE_STATUSES.map((s) => [s, 0])) as Record<CaseStatus, number>;
    for (const row of rows) byStatus[row.status] += 1;
    const open = rows.filter((r) => OPEN.includes(r.status));
    const unassigned = open.filter((r) => r.assignedAgentId === null);
    const awaiting = open.map((r) => ({ row: r, since: awaitingReplySince(r) })).filter((x): x is { row: (typeof rows)[number]; since: Date } => x.since !== null);
    awaiting.sort((a, b) => a.since.getTime() - b.since.getTime());
    const agents = new Map<string, AgentLoad>();
    for (const r of open) {
      if (!r.assignedAgentId) continue;
      const load = agents.get(r.assignedAgentId) ?? { agentId: r.assignedAgentId, open: 0, awaitingReply: 0 };
      load.open += 1;
      if (awaitingReplySince(r)) load.awaitingReply += 1;
      agents.set(r.assignedAgentId, load);
    }
    const cutoff = now.getTime() - thresholdHours * 3_600_000;
    // Waiting for a team counts as follow-up work too (§5.2 "cases requiring follow-up", BL-021): the same threshold applies.
    // A team owes an answer while a consultation is open, whatever status staff set meanwhile (BL-029, FND-0078).
    const consultationRows = await this.db
      .select({ caseId: caseConsultations.caseId, since: min(caseConsultations.requestedAt) })
      .from(caseConsultations)
      .where(eq(caseConsultations.status, 'open'))
      .groupBy(caseConsultations.caseId);
    const oldestOpenConsultation = new Map(consultationRows.filter((c) => c.since !== null).map((c) => [c.caseId, new Date(c.since as Date | string)]));
    const waitingInternal = open
      .map((r) => ({ row: r, since: waitingInternalSince(r, oldestOpenConsultation.get(r.id) ?? null) }))
      .filter((x): x is { row: (typeof rows)[number]; since: Date } => x.since !== null)
      .sort((a, b) => a.since.getTime() - b.since.getTime());
    // One entry per case: a case can both await a reply and wait for a team; it is listed once, at its oldest wait.
    const oldestWait = new Map<string, { row: (typeof rows)[number]; since: Date }>();
    for (const x of [...awaiting, ...waitingInternal]) {
      const seen = oldestWait.get(x.row.id);
      if (!seen || x.since.getTime() < seen.since.getTime()) oldestWait.set(x.row.id, x);
    }
    const overdueRows = [...oldestWait.values()]
      .filter((x) => x.since.getTime() <= cutoff)
      .sort((a, b) => a.since.getTime() - b.since.getTime())
      .slice(0, 50)
      .map((x) => x.row);
    const overdue = await this.cases.summariesOf(overdueRows);
    const oldestUnassigned = unassigned.reduce<Date | null>((acc, r) => (acc === null || r.createdAt < acc ? r.createdAt : acc), null);
    return {
      byStatus,
      unassigned: { count: unassigned.length, oldestCreatedAt: oldestUnassigned?.toISOString() ?? null },
      waitingInternal: { count: waitingInternal.length, oldestSince: waitingInternal[0]?.since.toISOString() ?? null },
      awaitingReply: { count: awaiting.length, oldestSince: awaiting[0]?.since.toISOString() ?? null },
      byAgent: [...agents.values()].sort((a, b) => b.open - a.open),
      attentionThresholdHours: thresholdHours,
      overdue,
      computedAt: now.toISOString(),
    };
  }

  async metrics(staff: StaffActor, periodDays: number, now = new Date()): Promise<ServiceMetrics> {
    this.assertSupervisor(staff);
    const from = new Date(now.getTime() - periodDays * 86_400_000);
    const created = await this.db.select().from(supportCases).where(and(gte(supportCases.createdAt, from), lt(supportCases.createdAt, now)));
    const createdIds = created.map((c) => c.id);
    // First public staff reply per case created in the period.
    const firstReplies = createdIds.length
      ? await this.db
          .select({ caseId: caseMessages.caseId, first: min(caseMessages.createdAt) })
          .from(caseMessages)
          .where(and(inArray(caseMessages.caseId, createdIds), eq(caseMessages.authorType, 'staff'), eq(caseMessages.visibility, 'public')))
          .groupBy(caseMessages.caseId)
      : [];
    const firstByCase = new Map(firstReplies.map((r) => [r.caseId, r.first]));
    const firstResponseMinutes = created
      .map((c) => {
        const first = firstByCase.get(c.id);
        return first ? (new Date(first).getTime() - c.createdAt.getTime()) / 60_000 : null;
      })
      .filter((m): m is number => m !== null);

    const events = await this.db
      .select({ caseId: caseEvents.caseId, type: caseEvents.type, createdAt: caseEvents.createdAt })
      .from(caseEvents)
      .where(and(gte(caseEvents.createdAt, from), lt(caseEvents.createdAt, now), inArray(caseEvents.type, ['case_resolved', 'case_closed', 'case_reopened'])))
      .orderBy(asc(caseEvents.createdAt));
    const resolvedEvents = events.filter((e) => e.type === 'case_resolved');
    const resolvedCaseIds = [...new Set(resolvedEvents.map((e) => e.caseId))];
    const resolvedCases = resolvedCaseIds.length ? await this.db.select({ id: supportCases.id, createdAt: supportCases.createdAt }).from(supportCases).where(inArray(supportCases.id, resolvedCaseIds)) : [];
    const createdAtByCase = new Map(resolvedCases.map((c) => [c.id, c.createdAt]));
    const resolutionMinutes = resolvedEvents
      .map((e) => {
        const start = createdAtByCase.get(e.caseId);
        return start ? (e.createdAt.getTime() - start.getTime()) / 60_000 : null;
      })
      .filter((m): m is number => m !== null);

    const open = await this.db.select().from(supportCases).where(inArray(supportCases.status, OPEN));
    const unanswered = open.map(awaitingReplySince).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime());
    const reopened = events.filter((e) => e.type === 'case_reopened').length;
    const resolved = resolvedEvents.length;
    return {
      periodDays,
      from: from.toISOString(),
      to: now.toISOString(),
      created: created.length,
      resolved,
      closed: events.filter((e) => e.type === 'case_closed').length,
      reopened,
      firstResponse: durationStats(firstResponseMinutes),
      resolution: durationStats(resolutionMinutes),
      unansweredNow: { count: unanswered.length, oldestMinutes: unanswered[0] ? Math.round((now.getTime() - unanswered[0].getTime()) / 60_000) : null },
      reopenRate: resolved > 0 ? Math.round((reopened / resolved) * 1000) / 1000 : null,
      targets: null,
    };
  }
}
