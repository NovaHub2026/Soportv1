import { describe, expect, it } from 'vitest';
import { describeAdapters, resolveIdentityProviderName, resolveOrbitRecordsName, resolveStaffDirectoryName } from '../identity.module.js';
import { OptaqodeClient, OptaqodeHttpError, OptaqodeTimeoutError, readErrorBody, type FetchLike } from './optaqode-client.js';
import { OPTAQODE_ENV, readOptaqodeConfig, requireIdentityConfig, requireServiceConfig } from './optaqode-config.js';
import { OptaqodeIdentity } from './optaqode-identity.js';
import { createJwtVerifier, decodeJwtPayload, signHs256 } from './optaqode-jwt.js';
import { isActiveMember, type OptaqodeRastreio, shortReference, toContactEmail, toCustomerSummary, toDepositRecord, toEnvironment, toOperationRecord, toRecords, toStaffRole, toWithdrawalRecord } from './optaqode-mappers.js';
import { OptaqodeRecords } from './optaqode-records.js';
import { createTokenSource, OptaqodeServiceAccountError, OptaqodeServiceSession, StaticToken } from './optaqode-service-session.js';
import { OptaqodeStaffDirectory } from './optaqode-staff-directory.js';

const BASE: NodeJS.ProcessEnv = { [OPTAQODE_ENV.apiBaseUrl]: 'https://dev-api.orbitmarket.pro/api/v1/' };
const SERVICE: NodeJS.ProcessEnv = { ...BASE, ORBIT_SERVICE_EMAIL: 'support-bot@orbitmarket.pro', ORBIT_SERVICE_PASSWORD: 'fixture-password' };
const SECRET = 'test-secret-do-not-use';
const CUSTOMER_ID = 'PRF_01HZX8K2M4N6P8Q0R2S4T6V8W';

/** Fixtures transcribed from the broker frontend's types (docs/integration/ORBIT-INTEGRATION.md §2–3, §5). Fictional data. */
const PROFILE = {
  id: CUSTOMER_ID,
  user_code: '104233',
  tenant_id: 'TEN_orbitmarket',
  email: 'alice.souza@example.com',
  email_verified: true,
  phone_normalized: '+5511999991234',
  phone_verified: false,
  country: 'br',
  username: 'alice.souza',
  first_name: 'Alice',
  last_name: 'Souza',
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  status: 'active',
  kyc_status_cache: 'approved',
  created_at: '2025-11-03T14:12:00.000Z',
  security: { level: 'high', email_verified: true, phone_verified: false, two_factor_enabled: true, identity_verified: true, identity_status: 'approved' },
};

const RASTREIO: OptaqodeRastreio = {
  person: PROFILE,
  wallets: [{ id: 'WAL_1', wallet_type: 'REAL', currency: 'USDT', status: 'active' }],
  deposits: [{ id: 'dep_0a1b2c3d4e5f6a7b8c9d', status: 'confirmed', amount: '250.00', currency: 'BRL', receive_amount: '48.50', quote_currency: 'USDT', method: 'pix', provider: 'psp-a', created_at: '2026-09-10T12:00:00.000Z' }],
  withdrawals: [{ id: 'wd_9f8e7d6c5b4a39281706', status: 'processing', requested_amount: '100.00', requested_currency: 'USDT', fee_amount: '2.00', final_amount: '98.00', receive_currency: 'BRL', created_at: '2026-09-12T09:30:00.000Z' }],
  operations: [{ id: 'op_1234567890abcdef1234', asset: 'EURUSD', status: 'SETTLED_WIN', direction: 'CALL', stake: '10.00', result: 'WIN', profit_amount: '8.50', currency: 'USDT', open_price: '1.0850', close_price: '1.0862', opened_at: '2026-09-11T15:00:00.000Z', expires_at: '2026-09-11T15:05:00.000Z', settled_at: '2026-09-11T15:05:01.000Z', wallet_id: 'WAL_1' }],
};

type Route = { status: number; body: unknown } | 'timeout' | ((init: { method: string; headers: Record<string, string>; body?: string }) => { status: number; body: unknown });

function fakeFetch(routes: Record<string, Route>): { fetch: FetchLike; calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> } {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const path = new URL(url).pathname + new URL(url).search;
    const route = Object.entries(routes).find(([prefix]) => path.startsWith(prefix))?.[1];
    if (!route) return { status: 404, json: async () => ({ error_code: 'NOT_FOUND', message: 'no route' }), text: async () => '' };
    if (route === 'timeout') {
      await new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
      throw new Error('unreachable');
    }
    const answer = typeof route === 'function' ? route(init) : route;
    return { status: answer.status, json: async () => answer.body, text: async () => JSON.stringify(answer.body) };
  };
  return { fetch, calls };
}

describe('optaqode configuration (PH-13, DEC-0045, DEC-0046)', () => {
  it('needs the base URL, https outside localhost, at most one local verification material, and a service credential per adapter', () => {
    expect(() => readOptaqodeConfig({})).toThrow(/ORBIT_API_BASE_URL is required/);
    expect(() => readOptaqodeConfig({ [OPTAQODE_ENV.apiBaseUrl]: 'http://api.orbitmarket.pro/api/v1' })).toThrow(/must use https/);
    expect(readOptaqodeConfig({ [OPTAQODE_ENV.apiBaseUrl]: 'http://local-api.orbitmarket.pro:3000/api/v1' }).apiBaseUrl).toBe('http://local-api.orbitmarket.pro:3000/api/v1');
    const config = readOptaqodeConfig(BASE);
    expect(config.apiBaseUrl).toBe('https://dev-api.orbitmarket.pro/api/v1');
    expect(config).toMatchObject({ httpTimeoutMs: 5000, staffCacheMs: 60_000, tokenCacheMs: 60_000 });
    expect(requireIdentityConfig(config)).toBe(config); // no local material: the broker verifies
    expect(() => requireIdentityConfig(readOptaqodeConfig({ ...BASE, ORBIT_JWT_SECRET: 's', ORBIT_JWT_JWKS_URL: 'https://x/jwks' }))).toThrow(/at most one/);
    expect(() => requireServiceConfig(config, 'records')).toThrow(/ORBIT_SERVICE_TOKEN, or ORBIT_SERVICE_EMAIL and ORBIT_SERVICE_PASSWORD/);
    expect(() => requireServiceConfig(readOptaqodeConfig({ ...BASE, ORBIT_SERVICE_EMAIL: 'x@y' }), 'records')).toThrow(/ORBIT_SERVICE_PASSWORD/);
    expect(requireServiceConfig(readOptaqodeConfig(SERVICE), 'records').serviceEmail).toBe('support-bot@orbitmarket.pro');
    expect(() => readOptaqodeConfig({ ...BASE, ORBIT_HTTP_TIMEOUT_MS: '0' })).toThrow(/positive integer/);
  });

  it('adapter selection: simulated by default, optaqode only with its material, unknown names refused', () => {
    expect(describeAdapters({})).toEqual({ identity: 'simulated', orbitRecords: 'simulated', staffDirectory: 'simulated' });
    expect(() => resolveIdentityProviderName({ SUPPORT_IDENTITY_PROVIDER: 'orbit' })).toThrow(/Unknown identity provider "orbit"/);
    expect(() => resolveIdentityProviderName({ SUPPORT_IDENTITY_PROVIDER: 'optaqode' })).toThrow(/ORBIT_API_BASE_URL/);
    expect(resolveIdentityProviderName({ SUPPORT_IDENTITY_PROVIDER: 'optaqode', ...BASE, NODE_ENV: 'production' })).toBe('optaqode');
    expect(() => resolveIdentityProviderName({ NODE_ENV: 'Production' })).toThrow(/Refusing to start/);
    expect(() => resolveOrbitRecordsName({ SUPPORT_ORBIT_RECORDS: 'optaqode', ...BASE })).toThrow(/ORBIT_SERVICE_TOKEN/);
    const real = { SUPPORT_ORBIT_RECORDS: 'optaqode', ...SERVICE };
    expect(resolveOrbitRecordsName(real)).toBe('optaqode');
    expect(resolveStaffDirectoryName(real)).toBe('optaqode'); // follows the records adapter
    expect(resolveStaffDirectoryName({ ...real, SUPPORT_STAFF_DIRECTORY: 'simulated' })).toBe('simulated');
    // The demo composition (DEC-0047): simulated staff beside the real customer path, named in health, refused in production without the switch.
    const demo = { SUPPORT_IDENTITY_PROVIDER: 'optaqode', SUPPORT_SIMULATED_STAFF: 'true', ...BASE };
    expect(describeAdapters(demo).identity).toBe('optaqode+simulated-staff');
    expect(() => resolveIdentityProviderName({ ...demo, NODE_ENV: 'production' })).toThrow(/simulated staff picker/);
    expect(resolveIdentityProviderName({ ...demo, NODE_ENV: 'production', SUPPORT_ALLOW_SIMULATED_IDENTITY: 'true' })).toBe('optaqode');
    expect(readOptaqodeConfig({ [OPTAQODE_ENV.apiBaseUrl]: 'http://127.0.0.1:3005/api/v1' }).apiBaseUrl).toBe('http://127.0.0.1:3005/api/v1');
  });
});

describe('composite identity (demo, DEC-0047)', () => {
  it('routes a bearer to the real provider, honours simulated staff headers only, and refuses a simulated customer header', async () => {
    const { CompositeIdentity } = await import('../composite-identity.js');
    const { SimulatedOrbitIdentity } = await import('../simulated-orbit-identity.js');
    const real = { resolve: async (h: { authorization?: string }) => (h.authorization === 'Bearer ok' ? ({ kind: 'customer', id: 'PRF_1', source: 'orbit' } as const) : null) };
    const composite = new CompositeIdentity(real, new SimulatedOrbitIdentity());
    await expect(composite.resolve({ authorization: 'Bearer ok' })).resolves.toMatchObject({ kind: 'customer', id: 'PRF_1' });
    await expect(composite.resolve({ 'x-simulated-staff-id': 'staff-carla' })).resolves.toMatchObject({ kind: 'staff', id: 'staff-carla', role: 'supervisor' });
    await expect(composite.resolve({ 'x-simulated-customer-id': 'cust-alice' })).resolves.toBeNull();
    await expect(composite.resolve({ authorization: 'Bearer ok', 'x-simulated-staff-id': 'staff-carla' })).resolves.toMatchObject({ kind: 'customer' }); // the bearer wins
    await expect(composite.resolve({})).resolves.toBeNull();
  });
});

describe('optaqode client', () => {
  it('sends the bearer and locale headers, parses the error shape, and turns a slow broker into a timeout', async () => {
    const { fetch, calls } = fakeFetch({ '/api/v1/ok': { status: 200, body: { fine: true } }, '/api/v1/bad': { status: 422, body: { error_code: 'VALIDATION', message: ['a', 'b'] } }, '/api/v1/slow': 'timeout' });
    const client = new OptaqodeClient(readOptaqodeConfig({ ...BASE, ORBIT_HTTP_TIMEOUT_MS: '20' }), fetch);
    await expect(client.get('/ok', { token: 't0k', language: 'es-ES' })).resolves.toEqual({ fine: true });
    expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer t0k', 'x-language-code': 'es-ES', 'Accept-Language': 'es-ES' });
    await expect(client.post('/ok', { a: 1 })).resolves.toEqual({ fine: true });
    expect(calls[1]).toMatchObject({ method: 'POST', body: '{"a":1}' });
    expect(calls[1].headers.Authorization).toBeUndefined();
    const error = await client.get('/bad', { token: 't' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OptaqodeHttpError);
    expect((error as OptaqodeHttpError).code).toBe('VALIDATION');
    expect((error as OptaqodeHttpError).message).toContain('a; b');
    await expect(client.get('/slow', { token: 't' })).rejects.toBeInstanceOf(OptaqodeTimeoutError);
    expect(readErrorBody({ code: 'X', error: 'boom' })).toEqual({ code: 'X', message: 'boom' });
    expect(readErrorBody(null)).toEqual({ code: null, message: 'no error body' });
  });
});

describe('optaqode token verification (optional local material)', () => {
  const config = readOptaqodeConfig({ ...BASE, ORBIT_JWT_SECRET: SECRET, ORBIT_JWT_ISSUER: 'orbit', ORBIT_JWT_AUDIENCE: 'app' });
  const now = () => Date.parse('2026-09-14T12:00:00.000Z');
  const exp = Math.floor(now() / 1000) + 600;

  it('accepts a valid HS256 token and refuses a bad signature, an expired one, a wrong issuer or audience, or an unknown algorithm', async () => {
    const verifier = createJwtVerifier(config, undefined, now);
    const good = signHs256({ sub: 'PRF_1', exp, iss: 'orbit', aud: ['app', 'other'] }, SECRET);
    await expect(verifier.verify(good)).resolves.toMatchObject({ sub: 'PRF_1' });
    expect(decodeJwtPayload(good)).toMatchObject({ sub: 'PRF_1', exp });
    expect(decodeJwtPayload('nope')).toBeNull();
    await expect(verifier.verify(signHs256({ sub: 'PRF_1', exp, iss: 'orbit', aud: 'app' }, 'other-secret'))).resolves.toBeNull();
    await expect(verifier.verify(signHs256({ sub: 'PRF_1', exp: exp - 1200, iss: 'orbit', aud: 'app' }, SECRET))).resolves.toBeNull();
    await expect(verifier.verify(signHs256({ sub: 'PRF_1', exp, iss: 'someone', aud: 'app' }, SECRET))).resolves.toBeNull();
    await expect(verifier.verify(signHs256({ sub: 'PRF_1', exp, iss: 'orbit', aud: 'admin' }, SECRET))).resolves.toBeNull();
    const [, payload] = good.split('.');
    const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${payload}.`;
    await expect(verifier.verify(none)).resolves.toBeNull();
    await expect(verifier.verify('not.a.token.at.all')).resolves.toBeNull();
  });

  it('verifies an ES256 token through a JWKS document, refreshing once on an unknown kid', async () => {
    const { generateKeyPairSync, sign } = await import('node:crypto');
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = { ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>), kid: 'k2', alg: 'ES256' };
    let fetches = 0;
    const fetchJwks = async () => {
      fetches += 1;
      return { keys: fetches === 1 ? [{ kty: 'EC', kid: 'k1' }] : [jwk] };
    };
    const verifier = createJwtVerifier(readOptaqodeConfig({ ...BASE, ORBIT_JWT_JWKS_URL: 'https://dev-api.orbitmarket.pro/.well-known/jwks.json' }), fetchJwks, now);
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'k2' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'PRF_2', exp })).toString('base64url');
    const signature = sign('sha256', Buffer.from(`${header}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    await expect(verifier.verify(`${header}.${body}.${signature}`)).resolves.toMatchObject({ sub: 'PRF_2' });
    expect(fetches).toBe(2);
    await expect(verifier.verify(`${header}.${body}.${signature.slice(0, -4)}AAAA`)).resolves.toBeNull();
  });
});

describe('optaqode identity provider', () => {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const directory = { isKnownStaff: async (id: string) => id === 'PRF_staff', roleOf: async (id: string) => (id === 'PRF_staff' ? { role: 'supervisor' as const } : undefined) };

  it('verified by the broker (DEC-0046 a): the customer is whoever /profiles/me answers for the token; staff by one admin read plus the directory; refusals and outages are nobody; verified tokens are cached by hash', async () => {
    const config = readOptaqodeConfig({ ...BASE, ORBIT_TOKEN_CACHE_MS: '1000' });
    const staffToken = signHs256({ sub: 'PRF_staff', name: 'Carla Nunes', exp }, 'whatever-the-backend-uses');
    const outsider = signHs256({ sub: 'PRF_outsider', exp }, 'x');
    const { fetch, calls } = fakeFetch({
      '/api/v1/profiles/me': (init) => (init.headers.Authorization === 'Bearer cust-ok' ? { status: 200, body: PROFILE } : init.headers.Authorization === 'Bearer cust-odd' ? { status: 200, body: { id: 'not valid!' } } : { status: 401, body: { error_code: 'AUTH_SESSION_INVALID' } }),
      '/api/v1/admin/team-members': (init) => (init.headers.Authorization === `Bearer ${staffToken}` || init.headers.Authorization === `Bearer ${outsider}` ? { status: 200, body: { items: [] } } : { status: 403, body: {} }),
    });
    let clock = 0;
    const identity = new OptaqodeIdentity(config, directory, new OptaqodeClient(config, fetch), undefined, () => clock);
    await expect(identity.resolve({ authorization: 'Bearer cust-ok' })).resolves.toEqual({ kind: 'customer', id: CUSTOMER_ID, source: 'orbit' });
    await expect(identity.resolve({ authorization: 'Bearer cust-ok' })).resolves.toMatchObject({ id: CUSTOMER_ID });
    expect(calls.filter((c) => c.url.includes('/profiles/me'))).toHaveLength(1); // cached
    clock = 2000;
    await expect(identity.resolve({ authorization: 'Bearer cust-ok' })).resolves.toMatchObject({ id: CUSTOMER_ID });
    expect(calls.filter((c) => c.url.includes('/profiles/me'))).toHaveLength(2); // expired, presented again
    await expect(identity.resolve({ authorization: 'Bearer cust-bad' })).resolves.toBeNull();
    await expect(identity.resolve({ authorization: 'Bearer cust-odd' })).resolves.toBeNull();
    await expect(identity.resolve({ authorization: `Bearer ${staffToken}`, 'x-orbit-actor': 'staff' })).resolves.toEqual({ kind: 'staff', id: 'PRF_staff', role: 'supervisor', displayName: 'Carla Nunes', source: 'orbit' });
    await expect(identity.resolve({ authorization: `Bearer ${outsider}`, 'x-orbit-actor': 'staff' })).resolves.toBeNull(); // valid for the broker, not in the support directory
    await expect(identity.resolve({ authorization: 'Bearer cust-ok', 'x-orbit-actor': 'staff' })).resolves.toBeNull(); // a customer token cannot claim staff (403 on the admin read)
    await expect(identity.resolve({})).resolves.toBeNull();
    await expect(identity.resolve({ authorization: 'Basic abc' })).resolves.toBeNull();
    const down = new OptaqodeIdentity(readOptaqodeConfig({ ...BASE, ORBIT_HTTP_TIMEOUT_MS: '20' }), directory, new OptaqodeClient(readOptaqodeConfig({ ...BASE, ORBIT_HTTP_TIMEOUT_MS: '20' }), fakeFetch({ '/api/v1/profiles/me': 'timeout' }).fetch));
    await expect(down.resolve({ authorization: 'Bearer cust-ok' })).resolves.toBeNull();
    expect(JSON.stringify(calls)).not.toContain('fixture-password');
  });

  it('verified locally when a secret is configured: the id is the token claim; a customer token cannot claim staff', async () => {
    const config = readOptaqodeConfig({ ...BASE, ORBIT_JWT_SECRET: SECRET });
    const { fetch, calls } = fakeFetch({});
    const identity = new OptaqodeIdentity(config, directory, new OptaqodeClient(config, fetch));
    const customer = signHs256({ sub: CUSTOMER_ID, exp }, SECRET);
    await expect(identity.resolve({ authorization: `Bearer ${customer}` })).resolves.toEqual({ kind: 'customer', id: CUSTOMER_ID, source: 'orbit' });
    const staff = signHs256({ person_id: 'PRF_staff', name: 'Carla Nunes', exp }, SECRET);
    await expect(identity.resolve({ authorization: `Bearer ${staff}`, 'x-orbit-actor': 'staff' })).resolves.toMatchObject({ kind: 'staff', id: 'PRF_staff', role: 'supervisor' });
    await expect(identity.resolve({ authorization: `Bearer ${customer}`, 'x-orbit-actor': 'staff' })).resolves.toBeNull();
    await expect(identity.resolve({ authorization: `Bearer ${signHs256({ exp }, SECRET)}` })).resolves.toBeNull(); // no id claim
    await expect(identity.resolve({ authorization: `Bearer ${signHs256({ sub: 'not valid!', exp }, SECRET)}` })).resolves.toBeNull();
    await expect(identity.resolve({ authorization: `Bearer ${signHs256({ sub: 'PRF_1', exp }, 'wrong')}` })).resolves.toBeNull();
    expect(calls).toHaveLength(0); // nothing asked to the broker
  });
});

describe('optaqode service session (DEC-0046 b)', () => {
  const config = readOptaqodeConfig({ ...SERVICE, ORBIT_HTTP_TIMEOUT_MS: '50' });

  it('logs in with the service account, reuses the token, refreshes before expiry, logs in again when the refresh is refused, and refuses a 2FA challenge', async () => {
    let logins = 0;
    let refreshes = 0;
    let refuseRefresh = false;
    const mint = (sub: string, seconds: number) => signHs256({ sub, exp: Math.floor(Date.now() / 1000) + seconds }, 'backend');
    const { fetch, calls } = fakeFetch({
      '/api/v1/admin/auth/login': (init) => {
        logins += 1;
        expect(JSON.parse(init.body!)).toEqual({ email: 'support-bot@orbitmarket.pro', password: 'fixture-password' });
        return { status: 200, body: { access_token: mint('PRF_bot', 90), refresh_token: `r${logins}`, expires_in: 90 } };
      },
      '/api/v1/auth/refresh': (init) => {
        refreshes += 1;
        if (refuseRefresh) return { status: 401, body: { error_code: 'AUTH_SESSION_INVALID' } };
        expect(JSON.parse(init.body!)).toEqual({ refreshToken: `r${logins}` });
        return { status: 200, body: { accessToken: mint('PRF_bot', 3600), refreshToken: `r${logins}` } };
      },
    });
    let clock = Date.now();
    const session = new OptaqodeServiceSession(config, new OptaqodeClient(config, fetch), () => clock);
    const first = await session.token();
    expect(logins).toBe(1);
    await expect(session.token()).resolves.toBe(first); // reused, 90 s ahead minus the margin
    clock += 45_000; // within the 60 s margin: refreshed
    const second = await session.token();
    expect(second).not.toBe(first);
    expect(refreshes).toBe(1);
    session.invalidate(); // a 401 downstream
    refuseRefresh = true;
    const third = await session.token();
    expect(logins).toBe(2);
    expect(third).not.toBe(second);
    expect(calls.every((c) => c.headers.Authorization === undefined)).toBe(true); // auth calls carry no bearer
    const twoFactor = fakeFetch({ '/api/v1/admin/auth/login': { status: 200, body: { challengeRequired: true, challengeMethod: 'email_otp', loginTicket: 'x' } } });
    await expect(new OptaqodeServiceSession(config, new OptaqodeClient(config, twoFactor.fetch)).token()).rejects.toBeInstanceOf(OptaqodeServiceAccountError);
    expect(createTokenSource(readOptaqodeConfig({ ...BASE, ORBIT_SERVICE_TOKEN: 'static' }))).toBeInstanceOf(StaticToken);
    expect(createTokenSource(config)).toBeInstanceOf(OptaqodeServiceSession);
  });
});

describe('optaqode mappers (shapes from the broker frontend)', () => {
  it('maps the profile to the masked customer summary and the verified contact address', () => {
    const summary = toCustomerSummary(PROFILE, toEnvironment(RASTREIO.wallets));
    expect(summary).toEqual({
      userId: CUSTOMER_ID,
      username: 'alice.souza',
      accountStatus: 'active',
      language: 'pt-BR',
      country: 'BR',
      registeredAt: '2025-11-03T14:12:00.000Z',
      emailMasked: 'a***@e***.com',
      phoneMasked: '+55 ••• ••• 1234',
      verificationStatus: 'verified',
      verificationNextAction: null,
      environment: 'real',
    });
    expect(JSON.stringify(summary)).not.toContain('alice.souza@example.com');
    expect(toContactEmail(PROFILE)).toBe('alice.souza@example.com');
    expect(toContactEmail({ ...PROFILE, email_verified: false, security: { ...PROFILE.security, email_verified: false } })).toBeNull();
    // Unknown vocabularies fall to the cautious side, never to "active" or "verified".
    const odd = toCustomerSummary({ id: 'PRF_x', status: 'weird', kyc_status: 'pending', security: { identity_verified: false } });
    expect(odd).toMatchObject({ accountStatus: 'restricted', verificationStatus: 'pending', username: 'PRF_x', country: '—' });
    expect(odd.verificationNextAction).toContain('Aguardar');
    expect(toCustomerSummary({ id: 'PRF_y', status: 'banned', kyc_status: 'rejected' })).toMatchObject({ accountStatus: 'blocked', verificationStatus: 'rejected' });
    expect(toEnvironment([{ id: 'w', wallet_type: 'DEMO' }])).toBe('demo');
    expect(toEnvironment(undefined)).toBe('real');
  });

  it('maps deposits, withdrawals and operations to records with readable statuses and a short identifier, newest first', () => {
    expect(toDepositRecord(RASTREIO.deposits![0])).toMatchObject({ kind: 'pix_deposit', reference: 'dep_0a1b2c3d4e5f6a7b8c9d', title: 'Depósito PIX', status: 'confirmado', amount: '250.00', currency: 'BRL', occurredAt: '2026-09-10T12:00:00.000Z' });
    expect(toDepositRecord(RASTREIO.deposits![0]).facts).toEqual([
      { label: 'Método', value: 'PIX' },
      { label: 'Creditado', value: '48.50 USDT' },
      { label: 'Provedor', value: 'psp-a' },
      { label: 'Identificador', value: '…6a7b8c9d' },
    ]);
    expect(toWithdrawalRecord(RASTREIO.withdrawals![0])).toMatchObject({ kind: 'withdrawal', title: 'Saque', status: 'em processamento', amount: '100.00', currency: 'USDT' });
    expect(toOperationRecord(RASTREIO.operations![0])).toMatchObject({ kind: 'operation', title: 'Operação EURUSD', status: 'encerrada — ganho', amount: '10.00', currency: 'USDT', occurredAt: '2026-09-11T15:00:00.000Z' });
    expect(toOperationRecord({ id: 'op', status: 'SOMETHING_NEW' }).status).toBe('SOMETHING_NEW'); // an unknown status is shown, not invented
    expect(toRecords(RASTREIO).map((r) => r.kind)).toEqual(['withdrawal', 'operation', 'pix_deposit']);
    expect(shortReference('abc')).toBe('abc');
  });

  it('maps back-office roles to support roles as the Owner decided (DEC-0046 c) and keeps only active members', () => {
    expect(toStaffRole('super_admin')).toBe('admin');
    expect(toStaffRole('admin')).toBe('supervisor');
    expect(toStaffRole('finance_manager')).toBe('agent');
    expect(toStaffRole('regional_admin')).toBe('agent');
    expect(toStaffRole('auditor')).toBe('agent');
    expect(toStaffRole('owner')).toBeUndefined();
    expect(isActiveMember({ id: 'x', status: 'active' })).toBe(true);
    expect(isActiveMember({ id: 'x', status: 'suspended' })).toBe(false);
  });
});

describe('optaqode records adapter', () => {
  const config = readOptaqodeConfig({ ...BASE, ORBIT_SERVICE_TOKEN: 'svc-token', ORBIT_HTTP_TIMEOUT_MS: '20' });

  it('reads the customer 360 with the service credential and answers available, not_found, timeout or unavailable honestly', async () => {
    const { fetch, calls } = fakeFetch({
      [`/api/v1/admin/rastreio/${CUSTOMER_ID}`]: { status: 200, body: RASTREIO },
      '/api/v1/admin/rastreio/PRF_missing': { status: 404, body: { error_code: 'NOT_FOUND', message: 'no' } },
      '/api/v1/admin/rastreio/PRF_slow': 'timeout',
      '/api/v1/admin/rastreio/PRF_down': { status: 503, body: { message: 'maintenance' } },
      '/api/v1/admin/rastreio/PRF_odd': { status: 200, body: { nothing: true } },
    });
    const records = new OptaqodeRecords(config, new OptaqodeClient(config, fetch));
    const summary = await records.customerSummary(CUSTOMER_ID);
    expect(summary).toMatchObject({ state: 'available', source: 'orbit', data: { username: 'alice.souza', emailMasked: 'a***@e***.com' } });
    expect(calls[0].headers.Authorization).toBe('Bearer svc-token');
    const list = await records.listRecords(CUSTOMER_ID);
    expect(list.state === 'available' && list.data.length).toBe(3);
    await expect(records.getRecord(CUSTOMER_ID, 'withdrawal', 'wd_9f8e7d6c5b4a39281706')).resolves.toMatchObject({ state: 'available', data: { title: 'Saque' } });
    await expect(records.getRecord(CUSTOMER_ID, 'withdrawal', 'dep_0a1b2c3d4e5f6a7b8c9d')).resolves.toMatchObject({ state: 'unavailable', reason: 'not_found' });
    await expect(records.contactEmail(CUSTOMER_ID)).resolves.toMatchObject({ state: 'available', data: 'alice.souza@example.com' });
    await expect(records.customerSummary('PRF_missing')).resolves.toMatchObject({ state: 'unavailable', reason: 'not_found' });
    await expect(records.customerSummary('PRF_slow')).resolves.toMatchObject({ state: 'unavailable', reason: 'timeout' });
    await expect(records.customerSummary('PRF_down')).resolves.toMatchObject({ state: 'unavailable', reason: 'unavailable' });
    await expect(records.customerSummary('PRF_odd')).resolves.toMatchObject({ state: 'unavailable', reason: 'unavailable' });
  });

  it('obtains a fresh service token and retries once when the broker answers 401 to the session token', async () => {
    let tokens = 0;
    const session = { token: async () => `svc-${++tokens}`, invalidate: () => {} };
    const { fetch, calls } = fakeFetch({ [`/api/v1/admin/rastreio/${CUSTOMER_ID}`]: (init) => (init.headers.Authorization === 'Bearer svc-1' ? { status: 401, body: {} } : { status: 200, body: RASTREIO }) });
    const records = new OptaqodeRecords(config, new OptaqodeClient(config, fetch), session);
    await expect(records.customerSummary(CUSTOMER_ID)).resolves.toMatchObject({ state: 'available' });
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer svc-1', 'Bearer svc-2']);
  });
});

describe('optaqode staff directory', () => {
  const config = readOptaqodeConfig({ ...BASE, ORBIT_SERVICE_TOKEN: 'svc-token', ORBIT_STAFF_CACHE_MS: '1000' });

  it('lists active members across pages with mapped roles, caches the listing, and keeps the last good one on a failed refresh', async () => {
    let fail = false;
    const page1 = { items: [{ id: 'PRF_a', name: 'Ana', role: 'auditor', status: 'active' }, { id: 'PRF_c', name: 'Carla', role: 'admin', status: 'active' }, { id: 'PRF_p', name: 'Paused', role: 'admin', status: 'paused' }], pagination: { page: 1, total_pages: 2 } };
    const page2 = { items: [{ id: 'PRF_d', name: 'Dani', role: 'super_admin', status: 'active' }], pagination: { page: 2, total_pages: 2 } };
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(url);
      if (fail) return { status: 500, json: async () => ({ message: 'down' }), text: async () => '' };
      const page = new URL(url).searchParams.get('page');
      return { status: 200, json: async () => (page === '2' ? page2 : page1), text: async () => '' };
    };
    let clock = 0;
    const directory = new OptaqodeStaffDirectory(config, new OptaqodeClient(config, fetch), new StaticToken('svc-token'), () => clock);
    await expect(directory.roleOf('PRF_a')).resolves.toEqual({ role: 'agent' });
    await expect(directory.roleOf('PRF_c')).resolves.toEqual({ role: 'supervisor' });
    await expect(directory.roleOf('PRF_d')).resolves.toEqual({ role: 'admin' });
    await expect(directory.isKnownStaff('PRF_p')).resolves.toBe(false); // paused
    await expect(directory.isKnownStaff('PRF_zz')).resolves.toBe(false);
    expect(calls).toHaveLength(2); // two pages, one read, then the cache
    clock = 2000;
    fail = true;
    await expect(directory.roleOf('PRF_a')).resolves.toEqual({ role: 'agent' }); // stale but kept
    expect(calls).toHaveLength(3);
  });

  it('refuses to answer when the first read fails: nobody is known until the broker answers once', async () => {
    const fetch: FetchLike = async () => ({ status: 503, json: async () => ({ message: 'down' }), text: async () => '' });
    const directory = new OptaqodeStaffDirectory(config, new OptaqodeClient(config, fetch));
    await expect(directory.isKnownStaff('PRF_a')).rejects.toBeInstanceOf(OptaqodeHttpError);
  });
});
