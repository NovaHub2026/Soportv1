import { Injectable } from '@nestjs/common';
import { maskEmail, maskPhone, type OrbitCustomerSummary, type OrbitLookup } from '@orbit-support/shared';
import type { OrbitRecordsPort } from './orbit-records.js';

/** What a real adapter would read from Orbit; kept inside the adapter so raw contact details never leave it. */
interface SimulatedCustomerRecord {
  userId: string;
  username: string;
  accountStatus: OrbitCustomerSummary['accountStatus'];
  language: string;
  country: string;
  registeredAt: string;
  email: string | null;
  phone: string | null;
  verificationStatus: OrbitCustomerSummary['verificationStatus'];
  verificationNextAction: string | null;
  environment: OrbitCustomerSummary['environment'];
}

/** Fixtures for the simulated customers of the web shell (DEC-0003). Fictional people and contacts. */
const CUSTOMERS: readonly SimulatedCustomerRecord[] = [
  {
    userId: 'cust-alice',
    username: 'alice.souza',
    accountStatus: 'active',
    language: 'pt-BR',
    country: 'BR',
    registeredAt: '2025-11-03T14:12:00.000Z',
    email: 'alice.souza@example.com',
    phone: '+55 11 99999-1234',
    verificationStatus: 'verified',
    verificationNextAction: null,
    environment: 'real',
  },
  {
    userId: 'cust-bruno',
    username: 'bruno.lima',
    accountStatus: 'active',
    language: 'pt-BR',
    country: 'BR',
    registeredAt: '2026-02-18T09:40:00.000Z',
    email: 'bruno.lima@example.com',
    phone: null,
    verificationStatus: 'pending',
    verificationNextAction: 'Enviar o comprovante de endereço pelo fluxo de verificação do Orbit',
    environment: 'real',
  },
  {
    userId: 'cust-carla',
    username: 'carla.mendes',
    accountStatus: 'restricted',
    language: 'es',
    country: 'AR',
    registeredAt: '2026-07-30T18:05:00.000Z',
    email: 'carla.mendes@example.com',
    phone: '+54 9 11 5555-9876',
    verificationStatus: 'unverified',
    verificationNextAction: 'Iniciar a verificação de identidade no Orbit',
    environment: 'demo',
  },
];

/**
 * SIMULATED Orbit records (DEC-0003): fixtures for the simulated customers, `not_found` for anyone else and an
 * outage mode (`SUPPORT_SIMULATED_ORBIT=unavailable`) so the "unavailable" experience can be exercised end to end.
 * Every answer carries `source: 'simulated'` so the UI labels it honestly (context §11, §14 item 10).
 */
@Injectable()
export class SimulatedOrbitRecords implements OrbitRecordsPort {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async customerSummary(userId: string): Promise<OrbitLookup<OrbitCustomerSummary>> {
    const meta = { source: 'simulated' as const, fetchedAt: new Date().toISOString() };
    if (this.env.SUPPORT_SIMULATED_ORBIT === 'unavailable') return { ...meta, state: 'unavailable', reason: 'unavailable' };
    const record = CUSTOMERS.find((c) => c.userId === userId);
    if (!record) return { ...meta, state: 'unavailable', reason: 'not_found' };
    return {
      ...meta,
      state: 'available',
      data: {
        userId: record.userId,
        username: record.username,
        accountStatus: record.accountStatus,
        language: record.language,
        country: record.country,
        registeredAt: record.registeredAt,
        emailMasked: record.email ? maskEmail(record.email) : null,
        phoneMasked: record.phone ? maskPhone(record.phone) : null,
        verificationStatus: record.verificationStatus,
        verificationNextAction: record.verificationNextAction,
        environment: record.environment,
      },
    };
  }
}
