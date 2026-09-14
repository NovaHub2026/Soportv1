/**
 * Local integration demo (PH-13.3, DEC-0047): the built API and web with the REAL `optaqode` adapters, pointed at
 * the SIMULATED broker of scripts/fake-broker.mjs — customers come through the real path (a bearer proven with
 * the broker, records from its customer 360, the panel embedded in a host page with the postMessage hand-off),
 * staff keep the simulated picker (SUPPORT_SIMULATED_STAFF). Loopback only; nothing here proves a connection to
 * the real broker (§11, §14 item 10) — it proves the mechanics.
 *
 * Usage (after `npm run build`):
 *   node scripts/demo-integration.mjs            # broker :3005, API :3001, web :3000 on 127.0.0.1; open http://127.0.0.1:3005
 *   node scripts/demo-integration.mjs --check    # start, run the integration checks, print a JSON report, stop
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WINDOWS = process.platform === 'win32';
const API = 'http://127.0.0.1:3001';
const WEB = 'http://127.0.0.1:3000';
const BROKER = 'http://127.0.0.1:3005';
const CHECK = process.argv.includes('--check');
const DATA = process.env.DEMO_DATA_DIR ?? join(ROOT, 'apps/api/.data/demo-integration');
const SERVICE_EMAIL = 'support-bot@local.test';
const SERVICE_PASSWORD = 'local-demo';

function portTaken(port) {
  return new Promise((done) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}
for (const port of [3000, 3001, 3005]) {
  if (await portTaken(port)) {
    console.error(`Port ${port} on 127.0.0.1 is already in use — stop that server first; the demo and its checks must run against the servers started here.`);
    process.exit(1);
  }
}
mkdirSync(join(DATA, 'pglite'), { recursive: true });
mkdirSync(join(DATA, 'uploads'), { recursive: true });

const children = [];
let stopping = false;
function stopAll() {
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      if (WINDOWS) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}
function start(name, cmd, args, cwd, env) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: !WINDOWS });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`[${name}] exited unexpectedly (code ${code}) — stopping the demo`);
    stopAll();
    process.exit(1);
  });
  children.push(child);
  return child;
}
process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

async function waitFor(url, label, accept, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (await accept(res)) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not answer at ${url} within ${timeoutMs / 1000} s`);
}

const json = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });
const asCustomer = (token) => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` });
const staff = { 'content-type': 'application/json', 'x-simulated-staff-id': 'staff-carla', 'x-simulated-staff-role': 'supervisor' };

/** The mechanics of the integration, end to end, against the simulated broker. */
async function integrationChecks() {
  const report = {};
  const health = await json(await fetch(`${WEB}/api/health`));
  report.health = health.body;
  if (health.status !== 200 || health.body?.identity !== 'optaqode+simulated-staff' || health.body?.orbitRecords !== 'optaqode') throw new Error('health does not name the optaqode adapters');
  const hostPage = await (await fetch(`${BROKER}/`)).text();
  report.hostPage = hostPage.includes('optaqode.app.token') && hostPage.includes('/embed');
  const embed = await (await fetch(`${WEB}/embed`)).text();
  report.embedServerRender = embed.includes('Conectando ao suporte') && !embed.includes('Alice');
  // A customer token the broker accepts becomes the customer named by /profiles/me; an expired one is nobody.
  const me = await json(await fetch(`${WEB}/api/identity/me`, { headers: asCustomer('demo-token-PRF_DEMO_ALICE') }));
  report.identity = me.body;
  if (me.status !== 200 || me.body?.id !== 'PRF_DEMO_ALICE' || me.body?.source !== 'orbit') throw new Error(`identity through the broker failed: ${me.status}`);
  report.expiredTokenRefused = (await fetch(`${WEB}/api/identity/me`, { headers: asCustomer('expired') })).status === 401;
  report.simulatedCustomerHeaderRefused = (await fetch(`${WEB}/api/identity/me`, { headers: { 'x-simulated-customer-id': 'cust-alice' } })).status === 401;
  // The customer's own records come from the broker's 360 through the service account.
  const records = await json(await fetch(`${WEB}/api/support/records`, { headers: asCustomer('demo-token-PRF_DEMO_ALICE') }));
  report.records = { state: records.body?.records?.state, source: records.body?.records?.source, count: records.body?.records?.data?.length ?? 0 };
  if (report.records.state !== 'available' || report.records.source !== 'orbit' || report.records.count !== 4) throw new Error(`records from the broker failed: ${JSON.stringify(report.records)}`);
  // A case opened with the real path, worked by simulated staff, whose Orbit context comes from the broker.
  const created = await json(await fetch(`${WEB}/api/support/cases`, { method: 'POST', headers: asCustomer('demo-token-PRF_DEMO_ALICE-1'), body: JSON.stringify({ category: 'deposits_withdrawals', message: 'Meu saque de 20 USDT está em processamento há dois dias.', record: { kind: 'withdrawal', reference: 'wd_48213aabbccddeeff001' } }) }));
  if (created.status !== 201) throw new Error(`case creation failed: ${created.status} ${JSON.stringify(created.body)}`);
  report.caseReference = created.body.reference;
  report.caseCustomerId = created.body.customerId;
  report.caseRecord = created.body.record ? { kind: created.body.record.kind, status: created.body.record.status } : null;
  const orbit = await json(await fetch(`${WEB}/api/staff/cases/${created.body.id}/orbit`, { headers: staff }));
  report.staffOrbitContext = { customer: orbit.body?.customer?.state, source: orbit.body?.customer?.source, emailMasked: orbit.body?.customer?.data?.emailMasked ?? null, phoneMasked: orbit.body?.customer?.data?.phoneMasked ?? null, record: orbit.body?.record?.state ?? null };
  if (report.staffOrbitContext.customer !== 'available' || report.staffOrbitContext.source !== 'orbit') throw new Error('staff Orbit context did not come from the broker');
  const reply = await json(await fetch(`${WEB}/api/staff/cases/${created.body.id}/messages`, { method: 'POST', headers: staff, body: JSON.stringify({ body: 'Verificamos com o financeiro: o saque será liberado hoje.' }) }));
  report.staffReply = reply.status === 201 ? reply.body?.authorName : `failed ${reply.status}`;
  const seen = await json(await fetch(`${WEB}/api/support/cases/${created.body.id}`, { headers: asCustomer('demo-token-PRF_DEMO_ALICE-2') }));
  report.customerSeesReply = seen.body?.messages?.some((m) => m.authorType === 'staff') === true;
  report.otherCustomerRefused = (await fetch(`${WEB}/api/support/cases/${created.body.id}`, { headers: asCustomer('demo-token-PRF_DEMO_BRUNO') })).status === 404;
  const text = JSON.stringify([orbit.body, seen.body, records.body]);
  report.rawContactNeverShown = !text.includes('alice.souza@example.com') && !text.includes('+5511999991234');
  const ok = report.hostPage && report.embedServerRender && report.expiredTokenRefused && report.simulatedCustomerHeaderRefused && report.customerSeesReply && report.otherCustomerRefused && report.rawContactNeverShown && report.staffReply === 'Carla Nunes';
  return { ok, ...report };
}

start('broker', process.execPath, ['scripts/fake-broker.mjs'], ROOT, { FAKE_BROKER_PORT: '3005', SUPPORT_PANEL_ORIGIN: WEB, FAKE_SERVICE_EMAIL: SERVICE_EMAIL, FAKE_SERVICE_PASSWORD: SERVICE_PASSWORD });
start('api', process.execPath, ['apps/api/dist/main.js'], ROOT, {
  NODE_ENV: 'production',
  SUPPORT_ALLOW_SIMULATED_IDENTITY: 'true',
  SUPPORT_BIND: '127.0.0.1',
  PORT: '3001',
  SUPPORT_DB_DIR: join(DATA, 'pglite'),
  SUPPORT_UPLOADS_DIR: join(DATA, 'uploads'),
  WEB_ORIGIN: WEB,
  SUPPORT_IDENTITY_PROVIDER: 'optaqode',
  SUPPORT_SIMULATED_STAFF: 'true',
  SUPPORT_ORBIT_RECORDS: 'optaqode',
  SUPPORT_STAFF_DIRECTORY: 'simulated',
  ORBIT_API_BASE_URL: `${BROKER}/api/v1`,
  ORBIT_SERVICE_EMAIL: SERVICE_EMAIL,
  ORBIT_SERVICE_PASSWORD: SERVICE_PASSWORD,
  ORBIT_TOKEN_CACHE_MS: '5000',
});
start('web', process.execPath, [join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', '3000', '-H', '127.0.0.1'], join(ROOT, 'apps/web'), { NODE_ENV: 'production', SUPPORT_EMBED_HOST_ORIGINS: BROKER });

try {
  await waitFor(`${BROKER}/health`, 'simulated broker', async (res) => res.status === 200);
  await waitFor(`${API}/api/health`, 'API', async (res) => res.status === 200 && (await res.json().catch(() => null))?.status === 'ok');
  await waitFor(`${WEB}/`, 'web', async (res) => res.status === 200);
  console.log(`\nOrbit Support integration demo (SIMULATED broker, loopback only): host page ${BROKER}  ·  staff: ${WEB}/staff`);
  if (CHECK) {
    const report = await integrationChecks();
    console.log(JSON.stringify(report, null, 2));
    stopAll();
    process.exit(report.ok ? 0 : 1);
  }
} catch (error) {
  console.error('integration demo failed:', error instanceof Error ? error.message : error);
  stopAll();
  process.exit(1);
}
