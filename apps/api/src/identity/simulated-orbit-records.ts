import { Injectable } from '@nestjs/common';
import { maskEmail, maskPhone, type OrbitCustomerSummary, type OrbitLookup, type OrbitRecord, type OrbitRecordKind } from '@orbit-support/shared';
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

/** Simulated records per customer (§6.1 subjects). Destinations and provider references are already masked. */
const RECORDS: Record<string, OrbitRecord[]> = {
  'cust-alice': [
    {
      kind: 'withdrawal',
      reference: 'WD-48213',
      title: 'Saque 250 USDT',
      status: 'Em processamento',
      occurredAt: '2026-09-13T21:40:00.000Z',
      amount: '250.00',
      currency: 'USDT',
      facts: [
        { label: 'Rede', value: 'TRON (TRC-20)' },
        { label: 'Taxa', value: '1.00 USDT' },
        { label: 'Destino', value: 'TX7f…9k2Q' },
        { label: 'Histórico', value: 'Solicitado 13/09 21:40 · Em análise 13/09 21:41' },
      ],
    },
    {
      kind: 'pix_deposit',
      reference: 'PIX-77110',
      title: 'Depósito Pix R$ 500,00',
      status: 'Confirmado',
      occurredAt: '2026-09-10T12:05:00.000Z',
      amount: '500.00',
      currency: 'BRL',
      facts: [
        { label: 'Conversão', value: 'R$ 5,42 por USDT' },
        { label: 'Creditado', value: '92.25 USDT' },
        { label: 'Referência do provedor', value: 'E2E…3F1A' },
      ],
    },
    {
      kind: 'operation',
      reference: 'OP-901223',
      title: 'Operação BTC/USDT · alta · 1 min',
      status: 'Liquidada · perda',
      occurredAt: '2026-09-12T15:30:00.000Z',
      amount: '20.00',
      currency: 'USDT',
      facts: [
        { label: 'Ativo', value: 'BTC/USDT' },
        { label: 'Direção', value: 'Alta' },
        { label: 'Payout contratado', value: '85%' },
        { label: 'Preço de entrada', value: '67 210.50' },
        { label: 'Preço de expiração', value: '67 198.10' },
        { label: 'Aceita / expirou', value: '12/09 15:30:00 · 12/09 15:31:00' },
      ],
    },
  ],
  'cust-bruno': [
    {
      kind: 'operation',
      reference: 'OP-901300',
      title: 'Operação ETH/USDT · baixa · 5 min',
      status: 'Liquidada · ganho',
      occurredAt: '2026-09-13T10:00:00.000Z',
      amount: '10.00',
      currency: 'USDT',
      facts: [
        { label: 'Ativo', value: 'ETH/USDT' },
        { label: 'Direção', value: 'Baixa' },
        { label: 'Payout contratado', value: '80%' },
      ],
    },
  ],
  'cust-carla': [],
};

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

  async listRecords(userId: string): Promise<OrbitLookup<OrbitRecord[]>> {
    const meta = { source: 'simulated' as const, fetchedAt: new Date().toISOString() };
    if (this.env.SUPPORT_SIMULATED_ORBIT === 'unavailable') return { ...meta, state: 'unavailable', reason: 'unavailable' };
    const records = RECORDS[userId];
    if (!records) return { ...meta, state: 'unavailable', reason: 'not_found' };
    return { ...meta, state: 'available', data: [...records].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) };
  }

  async getRecord(userId: string, kind: OrbitRecordKind, reference: string): Promise<OrbitLookup<OrbitRecord>> {
    const meta = { source: 'simulated' as const, fetchedAt: new Date().toISOString() };
    if (this.env.SUPPORT_SIMULATED_ORBIT === 'unavailable') return { ...meta, state: 'unavailable', reason: 'unavailable' };
    // Ownership is part of the lookup: another customer's record is simply not found (RULE-SUP-01).
    const record = (RECORDS[userId] ?? []).find((r) => r.kind === kind && r.reference === reference);
    if (!record) return { ...meta, state: 'unavailable', reason: 'not_found' };
    return { ...meta, state: 'available', data: record };
  }
}
