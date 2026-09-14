import { Logger } from '@nestjs/common';
import type { OrbitCustomerSummary, OrbitLookup, OrbitRecord, OrbitRecordKind, OrbitUnavailableReason } from '@orbit-support/shared';
import type { OrbitRecordsPort } from '../orbit-records.js';
import { OptaqodeClient, OptaqodeHttpError, OptaqodeTimeoutError } from './optaqode-client.js';
import { type OptaqodeConfig, requireServiceConfig } from './optaqode-config.js';
import { type OptaqodeRastreio, toContactEmail, toCustomerSummary, toEnvironment, toRecords } from './optaqode-mappers.js';

/**
 * Real records (PH-13, DEC-0045 b): the customer 360 the broker's own support console reads
 * (`GET /admin/rastreio/{userId}` — person, wallets, deposits, withdrawals, operations), read with Orbit
 * Support's service credential and mapped to the boundary's shapes. Read-only; every failure is an honest
 * `unavailable` with its reason (RULE-SUP-07), never a guess.
 */
export class OptaqodeRecords implements OrbitRecordsPort {
  private readonly logger = new Logger(OptaqodeRecords.name);
  private readonly token: string;

  constructor(
    config: OptaqodeConfig,
    private readonly client: OptaqodeClient = new OptaqodeClient(config),
  ) {
    this.token = requireServiceConfig(config, 'records').serviceToken;
  }

  async customerSummary(userId: string): Promise<OrbitLookup<OrbitCustomerSummary>> {
    return this.lookup(userId, (r) => toCustomerSummary(r.person, toEnvironment(r.wallets)));
  }

  async listRecords(userId: string): Promise<OrbitLookup<OrbitRecord[]>> {
    return this.lookup(userId, toRecords);
  }

  async getRecord(userId: string, kind: OrbitRecordKind, reference: string): Promise<OrbitLookup<OrbitRecord>> {
    const all = await this.listRecords(userId);
    if (all.state === 'unavailable') return all;
    const record = all.data.find((r) => r.kind === kind && r.reference === reference);
    return record ? { ...meta(), state: 'available', data: record } : { ...meta(), state: 'unavailable', reason: 'not_found' };
  }

  async contactEmail(userId: string): Promise<OrbitLookup<string | null>> {
    return this.lookup(userId, (r) => toContactEmail(r.person));
  }

  private async lookup<T>(userId: string, map: (rastreio: OptaqodeRastreio) => T): Promise<OrbitLookup<T>> {
    try {
      const rastreio = await this.client.get<OptaqodeRastreio>(`/admin/rastreio/${encodeURIComponent(userId)}`, { token: this.token });
      if (!rastreio || typeof rastreio !== 'object' || !rastreio.person?.id) return { ...meta(), state: 'unavailable', reason: 'unavailable' };
      return { ...meta(), state: 'available', data: map(rastreio) };
    } catch (error) {
      return { ...meta(), state: 'unavailable', reason: this.reasonOf(error, userId) };
    }
  }

  private reasonOf(error: unknown, userId: string): OrbitUnavailableReason {
    if (error instanceof OptaqodeTimeoutError) return 'timeout';
    if (error instanceof OptaqodeHttpError && error.status === 404) return 'not_found';
    // Only the status and the broker's code reach the log — never the customer's data.
    this.logger.warn(`Orbit lookup for a customer failed: ${error instanceof OptaqodeHttpError ? `${error.status} ${error.code ?? ''}` : error instanceof Error ? error.name : 'unknown'} (customer ${userId.slice(0, 4)}…)`);
    return 'unavailable';
  }
}

function meta(): { source: 'orbit'; fetchedAt: string } {
  return { source: 'orbit', fetchedAt: new Date().toISOString() };
}
