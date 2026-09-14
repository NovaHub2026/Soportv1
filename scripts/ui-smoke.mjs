#!/usr/bin/env node
/**
 * ui-smoke — drives the built customer panel in headless Chromium and saves screenshots as OBSERVED
 * evidence (GOVERNANCE.md §6.3: a promised screen is verified in a real client, not only through the API).
 *
 * Preconditions: `npm run build` (API dist + web .next), Playwright Chromium installed
 * (`npx playwright install chromium`). Uses API port 3001 (the web build's default API_ORIGIN) and web
 * port 3150 (`UI_WEB_PORT` overrides). Never run against a shared data directory: pass SUPPORT_DB_DIR to a
 * scratch path.
 *
 * Usage: SUPPORT_DB_DIR=/tmp/x node scripts/ui-smoke.mjs [outputDir]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// API must be 3001: the web build bakes its default API_ORIGIN into the rewrites. The web port is free to change.
const API_PORT = 3001;
const WEB_PORT = Number(process.env.UI_WEB_PORT ?? 3150);
const WEB = `http://localhost:${WEB_PORT}`;
const API = `http://localhost:${API_PORT}`;
const OUT = resolve(process.argv[2] ?? `${ROOT}/docs/evidence/screenshots/ph-1.3`);
mkdirSync(OUT, { recursive: true });

if (!process.env.SUPPORT_DB_DIR) {
  console.error('Refusing to run without SUPPORT_DB_DIR (would touch the developer database).');
  process.exit(2);
}

const children = [];
// Each server runs in its own process group so shutdown reaches grandchildren (e.g. `next start` → next-server);
// an orphaned server on the port would silently serve a stale build (learned in PH-1.3).
function start(name, cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  children.push(child);
  return child;
}

function stopAll(signal) {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  }
}

async function assertPortFree(port) {
  try {
    await fetch(`http://localhost:${port}/`);
  } catch {
    return; // nothing answered: free
  }
  throw new Error(`Port ${port} is already in use; stop that process before running the smoke`);
}

async function waitForHttp(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const observations = [];
function note(id, text) {
  observations.push({ id, text });
  console.log(`OBSERVED ${id}: ${text}`);
}

async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`screenshot ${path}`);
}

const staffHeaders = {
  'content-type': 'application/json',
  'x-simulated-staff-id': 'staff-ana',
  'x-simulated-staff-name': 'Ana',
};

let exitCode = 0;
try {
  await assertPortFree(API_PORT);
  await assertPortFree(WEB_PORT);
  start('api', 'node', ['apps/api/dist/main.js'], ROOT, { PORT: String(API_PORT) });
  start('web', `${ROOT}/node_modules/.bin/next`, ['start', '-p', String(WEB_PORT)], `${ROOT}/apps/web`);
  await waitForHttp(`${API}/api/health`);
  await waitForHttp(WEB);

  const browser = await chromium.launch();
  try {
    // ---- Desktop: panel as side panel, home → new request → conversation → staff reply appears ----
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
    await desktop.goto(WEB);
    await desktop.getByRole('heading', { name: 'Suporte' }).waitFor();
    await desktop.getByText('Você ainda não falou com o suporte.').waitFor();
    note('home', 'desktop shows the side panel with "Falar com o suporte" and an honest empty history');
    await shot(desktop, '01-home-desktop');

    await desktop.getByRole('button', { name: 'Falar com o suporte' }).click();
    await desktop.getByText('Como podemos ajudar?').waitFor();
    const send = desktop.getByRole('button', { name: 'Enviar' });
    if (!(await send.isDisabled())) throw new Error('Send should be disabled before topic and message');
    // Users click the chip (the label); the radio input itself is visually hidden.
    await desktop.getByText('Depósitos e saques', { exact: true }).click();
    if (!(await desktop.getByLabel('Depósitos e saques').isChecked())) throw new Error('Topic chip did not select');
    await desktop.getByLabel('Conte o que está acontecendo').fill('Meu saque em USDT ainda não chegou na carteira.');
    note('new-request', 'topic chips + message; send disabled until both are present');
    await shot(desktop, '02-new-request');

    await send.click();
    await desktop.getByText(/Referência SUP-\d{6}/).waitFor();
    await desktop.getByText('Recebido').waitFor();
    const reference = (await desktop.getByText(/Referência SUP-\d{6}/).textContent()).replace('Referência ', '');
    note('created', `case created from the panel with reference ${reference}, status "Recebido"`);
    await shot(desktop, '03-conversation-new');

    // Staff side through the API (the staff UI is PH-1.4): take the case and reply.
    const queue = await (await fetch(`${API}/api/staff/cases?view=unassigned`, { headers: staffHeaders })).json();
    const created = queue.find((c) => c.reference === reference);
    if (!created) throw new Error(`Case ${reference} not in the unassigned queue`);
    await fetch(`${API}/api/staff/cases/${created.id}/take`, { method: 'POST', headers: staffHeaders });
    const replyText = 'Olá! Aqui é a Ana, do suporte. Já estou verificando o seu saque.';
    const reply = await fetch(`${API}/api/staff/cases/${created.id}/messages`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ body: replyText }),
    });
    if (reply.status !== 201) throw new Error(`staff reply failed: ${reply.status}`);

    await desktop.getByText(replyText).waitFor({ timeout: 15_000 });
    await desktop.getByText('Em atendimento').waitFor();
    note('reply', 'staff reply attributed to "Ana" reached the customer panel by refresh within 15 s; status "Em atendimento"');
    await shot(desktop, '04-conversation-reply');

    // Customer follow-up from the composer.
    await desktop.getByLabel('Sua mensagem').fill('Obrigada! Fico no aguardo.');
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    await desktop.getByText('Obrigada! Fico no aguardo.').waitFor();
    note('follow-up', 'customer follow-up sent from the composer and shown as own message');

    // Continuity: reload, history still there.
    await desktop.reload();
    await desktop.getByText('Conversas em andamento').waitFor();
    await desktop.getByRole('button', { name: new RegExp(reference) }).waitFor();
    note('continuity', 'after reload the case is listed under "Conversas em andamento" with its reference');
    await shot(desktop, '05-home-with-case');

    // Privacy at the UI: another simulated customer sees nothing (RULE-SUP-01).
    await desktop.getByLabel('Conta simulada').selectOption('cust-bruno');
    await desktop.getByText('Você ainda não falou com o suporte.').waitFor();
    note('privacy', 'switching to another simulated customer shows an empty history, not Alice\'s case');
    await shot(desktop, '06-other-customer-empty');
    await desktop.close();

    // ---- Mobile: full-screen view toggled from the topbar ----
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
    await mobile.goto(WEB);
    await mobile.getByRole('heading', { name: 'Área de negociação' }).waitFor();
    if (await mobile.getByRole('heading', { name: 'Suporte' }).isVisible()) {
      throw new Error('Mobile should not show the panel until opened');
    }
    await mobile.getByRole('button', { name: 'Suporte' }).click();
    await mobile.getByRole('heading', { name: 'Suporte' }).waitFor();
    if (await mobile.getByRole('heading', { name: 'Área de negociação' }).isVisible()) {
      throw new Error('Mobile panel should take the full screen');
    }
    note('mobile', 'on a 390px viewport the panel is hidden until "Suporte" is tapped, then fills the screen');
    await shot(mobile, '07-mobile-panel');
    await mobile.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok: true, observations }, null, 2));
} catch (error) {
  exitCode = 1;
  console.error('UI smoke FAILED:', error);
  console.log(JSON.stringify({ ok: false, observations }, null, 2));
} finally {
  stopAll('SIGTERM');
  await new Promise((r) => setTimeout(r, 1500));
  stopAll('SIGKILL');
  process.exit(exitCode);
}
