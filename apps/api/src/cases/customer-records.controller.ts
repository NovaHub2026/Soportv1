import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { OrbitLookup, OrbitRecordListItem } from '@orbit-support/shared';
import { CurrentActor, CustomerGuard } from '../identity/guards.js';
import type { CustomerActor } from '../identity/identity.types.js';
import { ORBIT_RECORDS, type OrbitRecordsPort } from '../identity/orbit-records.js';
import { CasesService } from './cases.service.js';

/**
 * The customer's own Orbit records for contextual entry (PH-4.2, §4.2): each item says whether an active case
 * already exists for it, so the panel can offer to continue that conversation. Ownership lives in the adapter:
 * nobody can list or fetch another customer's records through this surface (RULE-SUP-01).
 */
@Controller('support/records')
@UseGuards(CustomerGuard)
export class CustomerRecordsController {
  constructor(
    private readonly cases: CasesService,
    @Inject(ORBIT_RECORDS) private readonly orbit: OrbitRecordsPort,
  ) {}

  @Get()
  async list(@CurrentActor() actor: CustomerActor): Promise<{ records: OrbitLookup<OrbitRecordListItem[]> }> {
    const lookup = await this.orbit.listRecords(actor.id);
    if (lookup.state !== 'available') return { records: lookup };
    const active = await this.cases.activeCasesByRecord(actor);
    const data = lookup.data.map((record) => {
      const open = active.get(`${record.kind}:${record.reference}`);
      return { ...record, activeCaseId: open?.id ?? null, activeCaseReference: open?.reference ?? null };
    });
    return { records: { ...lookup, data } };
  }
}
