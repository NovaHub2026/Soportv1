/**
 * Access-restricted local demo of Orbit Support (RELEASE.md, DEPLOYMENT.md "single-host demo"): the built API and
 * web on this machine only (loopback), NODE_ENV=production with the simulated identity explicitly allowed
 * (DEC-0008 demo switch), embedded PostgreSQL persisted under apps/api/.data/demo (gitignored).
 *
 * Usage (after `npm run build`):
 *   node scripts/demo-local.mjs            # start API :3001 and web :3000 on 127.0.0.1; Ctrl+C stops both
 *   node scripts/demo-local.mjs --check    # start, run the post-release checks, print a JSON report, stop
 *
 * The web build's /api rewrite points at 127.0.0.1:3001 (API_ORIGIN at build time), so these ports are fixed.
 * The launcher refuses to start when either port is already taken and stops as soon as one of its servers
 * exits, so the checks can only pass against the servers it started (Cycle Audit 3).
 * Nothing here is reachable from another machine; a public deployment follows docs/runbooks/DEPLOYMENT.md.
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
const CHECK = process.argv.includes('--check');
const DATA = process.env.DEMO_DATA_DIR ?? join(ROOT, 'apps/api/.data/demo');

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
for (const port of [3000, 3001]) {
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
const customer = (id) => ({ 'content-type': 'application/json', 'x-simulated-customer-id': id });
const staff = { 'content-type': 'application/json', 'x-simulated-staff-id': 'staff-ana' };

async function postReleaseChecks() {
  const report = {};
  const health = await json(await fetch(`${WEB}/api/health`));
  report.health = health.body;
  if (health.status !== 200 || health.body?.identity !== 'simulated') throw new Error('health through the web rewrite failed');
  const page = await fetch(`${WEB}/`);
  report.webHome = page.status;
  const direct = await fetch(`${API}/api/health`);
  report.securityHeaders = { xContentTypeOptions: direct.headers.get('x-content-type-options'), xPoweredBy: direct.headers.get('x-powered-by') };
  // §14 item 2: a question becomes a case, staff reply, the customer sees it and is notified.
  const created = await json(await fetch(`${WEB}/api/support/cases`, { method: 'POST', headers: customer('cust-alice'), body: JSON.stringify({ category: 'other', message: 'Verificação pós-release da demo.' }) }));
  if (created.status !== 201) throw new Error(`case creation failed: ${created.status}`);
  report.caseReference = created.body.reference;
  const reply = await json(await fetch(`${WEB}/api/staff/cases/${created.body.id}/messages`, { method: 'POST', headers: staff, body: JSON.stringify({ body: 'Resposta da verificação pós-release.' }) }));
  if (reply.status !== 201) throw new Error(`staff reply failed: ${reply.status}`);
  report.replyAuthor = reply.body?.authorName;
  const seen = await json(await fetch(`${WEB}/api/support/cases/${created.body.id}`, { headers: customer('cust-alice') }));
  report.customerSeesReply = seen.body?.messages?.some((m) => m.authorType === 'staff') === true;
  const notifications = await json(await fetch(`${WEB}/api/support/notifications`, { headers: customer('cust-alice') }));
  report.notified = notifications.body?.notifications?.some((n) => n.caseId === created.body.id && n.kind === 'staff_reply') === true;
  const other = await fetch(`${WEB}/api/support/cases/${created.body.id}`, { headers: customer('cust-bruno') });
  report.otherCustomerRefused = other.status === 404;
  const home = await (await fetch(`${WEB}/`)).text();
  report.serverRenderNeutral = !home.includes('Alice Souza') && !home.includes('Sair');
  const ok = report.webHome === 200 && report.customerSeesReply && report.notified && report.otherCustomerRefused && report.securityHeaders.xPoweredBy === null && report.serverRenderNeutral;
  return { ok, ...report };
}

start('api', process.execPath, ['apps/api/dist/main.js'], ROOT, {
  NODE_ENV: 'production',
  SUPPORT_ALLOW_SIMULATED_IDENTITY: 'true',
  SUPPORT_BIND: '127.0.0.1',
  PORT: '3001',
  SUPPORT_DB_DIR: join(DATA, 'pglite'),
  SUPPORT_UPLOADS_DIR: join(DATA, 'uploads'),
  WEB_ORIGIN: WEB,
});
start('web', process.execPath, [join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', '3000', '-H', '127.0.0.1'], join(ROOT, 'apps/web'), { NODE_ENV: 'production' });

try {
  await waitFor(`${API}/api/health`, 'API', async (res) => res.status === 200 && (await res.json().catch(() => null))?.status === 'ok');
  await waitFor(`${WEB}/`, 'web', async (res) => res.status === 200);
  console.log(`\nOrbit Support demo (simulated identity, loopback only): ${WEB}  ·  staff: ${WEB}/staff`);
  if (CHECK) {
    const report = await postReleaseChecks();
    console.log(JSON.stringify(report, null, 2));
    stopAll();
    process.exit(report.ok ? 0 : 1);
  }
} catch (error) {
  console.error('demo failed:', error instanceof Error ? error.message : error);
  stopAll();
  process.exit(1);
}
