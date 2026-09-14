import { Logger } from '@nestjs/common';
import type { StaffRole } from '@orbit-support/shared';
import type { StaffDirectory } from '../staff-directory.js';
import { OptaqodeClient } from './optaqode-client.js';
import { type OptaqodeConfig, requireServiceConfig } from './optaqode-config.js';
import { isActiveMember, type OptaqodeTeamMember, toStaffRole } from './optaqode-mappers.js';

interface TeamPage {
  items?: OptaqodeTeamMember[];
  pagination?: { page?: number; total_pages?: number; page_count?: number };
}

/**
 * Real staff directory (PH-13, DEC-0045 c): the broker's back-office team (`GET /admin/team-members`), active
 * members only, roles mapped by `STAFF_ROLE_MAP`. The listing is cached for `ORBIT_STAFF_CACHE_MS`; a failed
 * refresh keeps the last good listing (a transfer must not fail because the broker blinked) and logs once.
 */
export class OptaqodeStaffDirectory implements StaffDirectory {
  private readonly logger = new Logger(OptaqodeStaffDirectory.name);
  private readonly token: string;
  private members = new Map<string, { role: StaffRole }>();
  private fetchedAt = 0;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly config: OptaqodeConfig,
    private readonly client: OptaqodeClient = new OptaqodeClient(config),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.token = requireServiceConfig(config, 'staff directory').serviceToken;
  }

  async isKnownStaff(id: string): Promise<boolean> {
    return (await this.roleOf(id)) !== undefined;
  }

  async roleOf(id: string): Promise<{ role: StaffRole } | undefined> {
    await this.ensureFresh();
    return this.members.get(id);
  }

  private async ensureFresh(): Promise<void> {
    if (this.now() - this.fetchedAt < this.config.staffCacheMs && this.members.size > 0) return;
    if (!this.pending) this.pending = this.refresh().finally(() => (this.pending = null));
    await this.pending;
  }

  private async refresh(): Promise<void> {
    try {
      const next = new Map<string, { role: StaffRole }>();
      let page = 1;
      for (;;) {
        const listing = await this.client.get<TeamPage>(`/admin/team-members?page=${page}&limit=100`, { token: this.token });
        for (const member of listing.items ?? []) {
          const role = toStaffRole(member.role);
          if (member.id && role && isActiveMember(member)) next.set(member.id, { role });
        }
        const pages = listing.pagination?.total_pages ?? listing.pagination?.page_count ?? 1;
        if (page >= pages || (listing.items ?? []).length === 0) break;
        page += 1;
      }
      this.members = next;
      this.fetchedAt = this.now();
    } catch (error) {
      if (this.members.size === 0) throw error;
      this.logger.warn(`Orbit staff directory refresh failed (${error instanceof Error ? error.name : 'unknown'}); keeping ${this.members.size} members from the last read`);
      this.fetchedAt = this.now();
    }
  }
}
