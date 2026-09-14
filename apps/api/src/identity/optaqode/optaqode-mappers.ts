import { maskEmail, maskPhone, type OrbitCustomerSummary, type OrbitRecord, type StaffRole } from '@orbit-support/shared';

/**
 * The broker's wire shapes Orbit Support depends on, transcribed from its frontend (snake_case, decimal strings,
 * ISO-8601 timestamps — `docs/integration/ORBIT-INTEGRATION.md` §3). Only the fields the mappers read are typed;
 * everything else stays `unknown` on purpose so a change in the broker does not silently mean something here.
 * Enum vocabularies the frontend does not fix (`status`, `kyc_status`) are mapped with an explicit fallback.
 */
export interface OptaqodeProfile {
  id: string;
  user_code?: string;
  tenant_id?: string;
  email?: string | null;
  email_verified?: boolean;
  phone?: string | null;
  phone_normalized?: string | null;
  phone_verified?: boolean;
  country?: string | null;
  country_code?: string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  language?: string | null;
  timezone?: string | null;
  status?: string | null;
  kyc_status?: string | null;
  kyc_status_cache?: string | null;
  created_at?: string | null;
  security?: {
    identity_verified?: boolean;
    identity_status?: string | null;
    email_verified?: boolean;
    phone_verified?: boolean;
  } | null;
}

export interface OptaqodeDeposit {
  id: string;
  status?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  receive_amount?: string | number | null;
  quote_currency?: string | null;
  method?: string | null;
  provider?: string | null;
  created_at?: string | null;
}

export interface OptaqodeWithdrawal {
  id: string;
  status?: string | null;
  requested_amount?: string | number | null;
  requested_currency?: string | null;
  fee_amount?: string | number | null;
  final_amount?: string | number | null;
  receive_currency?: string | null;
  created_at?: string | null;
}

export interface OptaqodeOperation {
  id: string;
  asset?: string | null;
  status?: string | null;
  direction?: string | null;
  stake?: string | number | null;
  result?: string | null;
  profit_amount?: string | number | null;
  currency?: string | null;
  open_price?: string | number | null;
  close_price?: string | number | null;
  opened_at?: string | null;
  expires_at?: string | null;
  settled_at?: string | null;
  wallet_id?: string | null;
}

export interface OptaqodeWallet {
  id: string;
  wallet_type?: string | null;
  currency?: string | null;
  status?: string | null;
}

/** `GET /admin/rastreio/{userId}` — the customer 360 the broker's own support console reads. */
export interface OptaqodeRastreio {
  person: OptaqodeProfile;
  wallets?: OptaqodeWallet[];
  deposits?: OptaqodeDeposit[];
  withdrawals?: OptaqodeWithdrawal[];
  operations?: OptaqodeOperation[];
}

/** `GET /admin/team-members` row. */
export interface OptaqodeTeamMember {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
}

// ---- customer summary ----

const ACCOUNT_STATUS: Record<string, OrbitCustomerSummary['accountStatus']> = {
  active: 'active',
  restricted: 'restricted',
  limited: 'restricted',
  blocked: 'blocked',
  banned: 'blocked',
  suspended: 'blocked',
  closed: 'closed',
  deleted: 'closed',
};

const VERIFICATION: Record<string, OrbitCustomerSummary['verificationStatus']> = {
  approved: 'verified',
  verified: 'verified',
  pending: 'pending',
  in_review: 'pending',
  rejected: 'rejected',
  none: 'unverified',
  unverified: 'unverified',
};

const NEXT_ACTION: Partial<Record<OrbitCustomerSummary['verificationStatus'], string>> = {
  pending: 'Aguardar a análise da verificação de identidade no Orbit',
  unverified: 'Iniciar a verificação de identidade no Orbit (Configurações → Segurança)',
  rejected: 'Refazer a verificação de identidade no Orbit com documentos válidos',
};

function lower(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** The customer summary of §6.1 from the broker's profile; raw contact details are masked here and only here. */
export function toCustomerSummary(profile: OptaqodeProfile, environment: OrbitCustomerSummary['environment'] = 'real'): OrbitCustomerSummary {
  const kyc = lower(profile.kyc_status ?? profile.kyc_status_cache ?? profile.security?.identity_status);
  const verificationStatus = profile.security?.identity_verified ? 'verified' : (VERIFICATION[kyc] ?? 'unverified');
  const email = profile.email?.trim() || null;
  const phone = (profile.phone_normalized ?? profile.phone)?.trim() || null;
  return {
    userId: profile.id,
    username: profile.username?.trim() || profile.user_code?.trim() || [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || profile.id,
    accountStatus: ACCOUNT_STATUS[lower(profile.status)] ?? 'restricted',
    language: profile.language?.trim() || 'pt-BR',
    country: (profile.country ?? profile.country_code ?? '').trim().toUpperCase() || '—',
    registeredAt: profile.created_at ?? new Date(0).toISOString(),
    emailMasked: email ? maskEmail(email) : null,
    phoneMasked: phone ? maskPhone(phone) : null,
    verificationStatus,
    verificationNextAction: NEXT_ACTION[verificationStatus] ?? null,
    environment,
  };
}

/** The address notifications may use: only a verified one (§10.2; an unverified address is "no address"). */
export function toContactEmail(profile: OptaqodeProfile): string | null {
  const verified = profile.email_verified ?? profile.security?.email_verified ?? false;
  const email = profile.email?.trim();
  return verified && email ? email : null;
}

// ---- records ----

function amount(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'number' ? value.toString() : value.trim();
}

const DEPOSIT_STATUS: Record<string, string> = {
  initiated: 'iniciado',
  pending: 'pendente',
  confirmed: 'confirmado',
  paid: 'confirmado',
  expired: 'expirado',
  failed: 'falhou',
  rejected: 'recusado',
};

const WITHDRAWAL_STATUS: Record<string, string> = {
  processing: 'em processamento',
  approved: 'aprovado',
  paid: 'pago',
  rejected: 'recusado',
};

const OPERATION_STATUS: Record<string, string> = {
  OPEN: 'em andamento',
  SETTLED_WIN: 'encerrada — ganho',
  SETTLED_LOSS: 'encerrada — perda',
  SETTLED_DRAW: 'encerrada — empate',
  CANCELLED: 'cancelada',
  EXPIRED: 'expirada',
};

function status(map: Record<string, string>, raw: string | null | undefined): string {
  const key = (raw ?? '').trim();
  return map[key] ?? map[key.toLowerCase()] ?? (key || 'desconhecido');
}

/** A short id a customer can read back to an agent: the broker's ids are opaque, so the tail is shown. */
export function shortReference(id: string): string {
  return id.length > 12 ? `…${id.slice(-8)}` : id;
}

export function toDepositRecord(deposit: OptaqodeDeposit): OrbitRecord {
  const method = (deposit.method ?? '').trim();
  const facts = [
    { label: 'Método', value: method ? method.toUpperCase() : '—' },
    ...(deposit.receive_amount ? [{ label: 'Creditado', value: `${amount(deposit.receive_amount)} ${deposit.quote_currency ?? ''}`.trim() }] : []),
    ...(deposit.provider ? [{ label: 'Provedor', value: deposit.provider }] : []),
    { label: 'Identificador', value: shortReference(deposit.id) },
  ];
  return {
    kind: 'pix_deposit',
    reference: deposit.id,
    title: `Depósito ${method ? method.toUpperCase() : ''}`.trim(),
    status: status(DEPOSIT_STATUS, deposit.status),
    occurredAt: deposit.created_at ?? new Date(0).toISOString(),
    amount: amount(deposit.amount),
    currency: deposit.currency ?? null,
    facts,
  };
}

export function toWithdrawalRecord(withdrawal: OptaqodeWithdrawal): OrbitRecord {
  const facts = [
    ...(withdrawal.fee_amount ? [{ label: 'Taxa', value: `${amount(withdrawal.fee_amount)} ${withdrawal.requested_currency ?? ''}`.trim() }] : []),
    ...(withdrawal.final_amount ? [{ label: 'Valor líquido', value: `${amount(withdrawal.final_amount)} ${withdrawal.receive_currency ?? withdrawal.requested_currency ?? ''}`.trim() }] : []),
    { label: 'Identificador', value: shortReference(withdrawal.id) },
  ];
  return {
    kind: 'withdrawal',
    reference: withdrawal.id,
    title: 'Saque',
    status: status(WITHDRAWAL_STATUS, withdrawal.status),
    occurredAt: withdrawal.created_at ?? new Date(0).toISOString(),
    amount: amount(withdrawal.requested_amount),
    currency: withdrawal.requested_currency ?? null,
    facts,
  };
}

export function toOperationRecord(operation: OptaqodeOperation): OrbitRecord {
  const direction = (operation.direction ?? '').toUpperCase();
  const facts = [
    { label: 'Direção', value: direction === 'CALL' ? 'Compra (CALL)' : direction === 'PUT' ? 'Venda (PUT)' : direction || '—' },
    ...(operation.open_price ? [{ label: 'Preço de abertura', value: amount(operation.open_price) ?? '—' }] : []),
    ...(operation.close_price ? [{ label: 'Preço de fechamento', value: amount(operation.close_price) ?? '—' }] : []),
    ...(operation.profit_amount ? [{ label: 'Resultado', value: `${amount(operation.profit_amount)} ${operation.currency ?? ''}`.trim() }] : []),
    ...(operation.expires_at ? [{ label: 'Expiração', value: operation.expires_at }] : []),
    { label: 'Identificador', value: shortReference(operation.id) },
  ];
  return {
    kind: 'operation',
    reference: operation.id,
    title: `Operação ${operation.asset ?? ''}`.trim(),
    status: status(OPERATION_STATUS, operation.status),
    occurredAt: operation.opened_at ?? operation.settled_at ?? new Date(0).toISOString(),
    amount: amount(operation.stake),
    currency: operation.currency ?? null,
    facts,
  };
}

/** Every record of a customer 360, newest first. */
export function toRecords(rastreio: OptaqodeRastreio): OrbitRecord[] {
  const records = [
    ...(rastreio.deposits ?? []).map(toDepositRecord),
    ...(rastreio.withdrawals ?? []).map(toWithdrawalRecord),
    ...(rastreio.operations ?? []).map(toOperationRecord),
  ];
  return records.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** `real` when any real wallet exists, `demo` when only demo wallets do — the summary's environment. */
export function toEnvironment(wallets: OptaqodeWallet[] | undefined): OrbitCustomerSummary['environment'] {
  if (!wallets || wallets.length === 0) return 'real';
  return wallets.some((w) => (w.wallet_type ?? '').toUpperCase() === 'REAL') ? 'real' : 'demo';
}

// ---- staff ----

/**
 * The broker's back-office roles onto Orbit Support's three (DEC-0029). Owner, 2026-09-14 (DEC-0046 c): support is
 * supervised by admins and super admins — `super_admin` is our admin (supervision plus exports), `admin` our
 * supervisor, everyone else works as an agent.
 */
export const STAFF_ROLE_MAP: Record<string, StaffRole> = {
  super_admin: 'admin',
  admin: 'supervisor',
  regional_admin: 'agent',
  finance_manager: 'agent',
  product_manager: 'agent',
  auditor: 'agent',
};

export function toStaffRole(role: string | null | undefined): StaffRole | undefined {
  return STAFF_ROLE_MAP[lower(role)];
}

/** Only active members exist for support: paused, suspended and pending ones cannot receive a case. */
export function isActiveMember(member: OptaqodeTeamMember): boolean {
  return lower(member.status) === 'active';
}
