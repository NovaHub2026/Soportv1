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
const OUT = resolve(process.argv[2] ?? `${ROOT}/docs/evidence/screenshots/latest`);
/** Live delivery must beat the old 5 s poll by a clear margin (PH-2.1). */
const LIVE_DELIVERY_BUDGET_MS = 3000;
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

let exitCode = 0;
try {
  await assertPortFree(API_PORT);
  await assertPortFree(WEB_PORT);
  start('api', 'node', ['apps/api/dist/main.js'], ROOT, { PORT: String(API_PORT) });
  start('web', `${ROOT}/node_modules/.bin/next`, ['start', '-p', String(WEB_PORT)], `${ROOT}/apps/web`);
  await waitForHttp(`${API}/api/health`);
  await waitForHttp(WEB);

  const browser = await chromium.launch();
  // On failure, capture every open page so the evidence shows what the UI looked like at that moment.
  const captureFailure = async () => {
    let n = 0;
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        n += 1;
        await page.screenshot({ path: `${OUT}/failure-${n}.png` }).catch(() => {});
      }
    }
  };
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

    // Staff side in the real workspace (PH-1.4): queue → open → take → reply.
    const staffPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
    await staffPage.goto(`${WEB}/staff`);
    await staffPage.getByRole('tab', { name: 'Não atribuídos' }).waitFor();
    const queueItem = staffPage.getByRole('button', { name: new RegExp(reference) });
    await queueItem.waitFor({ timeout: 15_000 });
    await staffPage.getByLabel('1 nova do cliente').waitFor();
    await staffPage.getByText('Ao vivo').waitFor();
    note('staff-queue', `the unassigned queue lists ${reference} with an unread badge ("1 nova do cliente"); connection shows "Ao vivo"`);
    await shot(staffPage, '08-staff-queue');

    await queueItem.click();
    // Opening the case marks the customer's message read; the queue badge disappears live.
    await staffPage.getByLabel('1 nova do cliente').waitFor({ state: 'detached', timeout: 5000 });
    note('staff-read', 'opening the case clears its unread badge in the queue');
    await staffPage.getByRole('button', { name: 'Assumir caso' }).click();
    await staffPage.getByText('staff-ana').first().waitFor();
    await staffPage.getByText('Em atendimento').first().waitFor();
    note('staff-take', 'taking the case shows Ana as responsible and moves the status to "Em atendimento"');

    const replyText = 'Olá! Aqui é a Ana, do suporte. Já estou verificando o seu saque.';
    await staffPage.getByLabel('Resposta ao cliente').fill(replyText);
    const sentAt = Date.now();
    await staffPage.getByRole('button', { name: 'Responder ao cliente' }).click();
    await staffPage.getByText(replyText).waitFor();

    // Live delivery (ADR-0004): the customer panel is open in another page and must show the reply
    // well under the old 5 s poll, without any reload.
    await desktop.getByText(replyText).waitFor({ timeout: 15_000 });
    const liveMs = Date.now() - sentAt;
    if (liveMs > LIVE_DELIVERY_BUDGET_MS) throw new Error(`Staff reply took ${liveMs} ms to reach the customer (budget ${LIVE_DELIVERY_BUDGET_MS} ms)`);
    await desktop.getByText('Em atendimento').waitFor();
    await desktop.getByText('Ao vivo').waitFor();
    note('reply-live', `staff reply attributed to "Ana Ribeiro" reached the open customer panel in ${liveMs} ms via the live stream; status "Em atendimento"; connection "Ao vivo"`);
    await shot(desktop, '04-conversation-reply');

    // The customer has the conversation open, so the reply counts as read — staff see that, live.
    await staffPage.getByText(/Última resposta lida pelo cliente/).waitFor({ timeout: 5000 });
    note('read-receipt', 'staff see "Última resposta lida pelo cliente" once the open customer panel received the reply');

    await staffPage.getByText(/integração com o Orbit ainda não foi construída/).waitFor();
    // A poll that raced the reply must not make the message vanish (regression found in PH-1.4).
    await staffPage.waitForTimeout(2500);
    if (!(await staffPage.getByText(replyText).isVisible())) throw new Error('Staff reply disappeared after a refresh');
    await staffPage.getByText('Atribuído a Ana Ribeiro').waitFor();
    note('staff-reply', 'the public reply stays visible across refreshes; the context column shows Orbit data as unavailable and the assignment in the history');
    await shot(staffPage, '09-staff-case-reply');

    // Customer follow-up from the composer, delivered live to the open staff case view.
    const followUp = 'Obrigada! Fico no aguardo.';
    await desktop.getByLabel('Sua mensagem').fill(followUp);
    const followUpAt = Date.now();
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    await desktop.getByText(followUp).waitFor();
    await staffPage.getByText(followUp).waitFor({ timeout: 15_000 });
    const followUpMs = Date.now() - followUpAt;
    if (followUpMs > LIVE_DELIVERY_BUDGET_MS) throw new Error(`Customer message took ${followUpMs} ms to reach staff (budget ${LIVE_DELIVERY_BUDGET_MS} ms)`);
    await desktop.waitForTimeout(2500);
    if (!(await desktop.getByText(followUp).isVisible())) throw new Error('Customer message disappeared after a refresh');
    note('follow-up-live', `customer follow-up shown as own message, still there after a refresh, and visible in the staff case view in ${followUpMs} ms`);

    // Offline: a message typed without connectivity is marked "Não enviada", then delivered exactly once on reconnect.
    const offlineText = 'Mandei isto sem internet.';
    await desktop.context().setOffline(true);
    await desktop.getByLabel('Sua mensagem').fill(offlineText);
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    await desktop.getByText('Não enviada').waitFor({ timeout: 10_000 });
    note('offline-failed', 'with the network off, the message is kept visible as "Não enviada" with a manual "Reenviar" option');
    await shot(desktop, '10-offline-failed');
    await desktop.context().setOffline(false);
    // Recovery must not depend on the stream noticing the outage: the browser's `online` event and the
    // periodic retry also resend. Budget covers the 15 s fallback cadence.
    await desktop.getByText('Não enviada').waitFor({ state: 'detached', timeout: 30_000 });
    await desktop.getByText('Ao vivo').waitFor({ timeout: 60_000 });
    await staffPage.getByText(offlineText).waitFor({ timeout: 10_000 });
    if ((await staffPage.getByText(offlineText).count()) !== 1) throw new Error('Offline message was duplicated on the staff side');
    if ((await desktop.getByText(offlineText).count()) !== 1) throw new Error('Offline message was duplicated on the customer side');
    note('offline-recovered', 'after reconnecting, the pending message was resent automatically and appears exactly once on both sides');

    await staffPage.getByRole('tab', { name: 'Meus casos' }).click();
    await staffPage.getByRole('button', { name: new RegExp(reference) }).waitFor();
    await staffPage.getByRole('tab', { name: 'Não atribuídos' }).click();
    await staffPage.getByText('Nenhum caso aguardando atribuição.').waitFor();
    note('staff-queues', 'after taking, the case is under "Meus casos" and the unassigned queue is empty');

    // Unread for the customer: back on the home screen, a second staff reply shows a badge live.
    await desktop.getByRole('button', { name: /Voltar/ }).click();
    await desktop.getByText('Conversas em andamento').waitFor();
    await staffPage.getByRole('tab', { name: 'Meus casos' }).click();
    await staffPage.getByRole('button', { name: new RegExp(reference) }).click();
    await staffPage.getByLabel('Resposta ao cliente').fill('Mais uma informação para você.');
    await staffPage.getByRole('button', { name: 'Responder ao cliente' }).click();
    await desktop.getByLabel('1 nova mensagem').waitFor({ timeout: 5000 });
    note('home-unread-live', 'on the home screen the case shows "1 nova mensagem" within seconds of a new staff reply');
    await shot(desktop, '11-home-unread');
    await desktop.getByRole('button', { name: new RegExp(reference) }).click();
    await desktop.getByText('Mais uma informação para você.').waitFor();
    await staffPage.getByText(/Última resposta lida pelo cliente/).waitFor({ timeout: 5000 });
    await desktop.getByRole('button', { name: /Voltar/ }).click();
    await desktop.getByLabel('1 nova mensagem').waitFor({ state: 'detached', timeout: 5000 });
    note('home-unread-cleared', 'opening the conversation clears the badge and staff see the reply as read');
    await staffPage.close();

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
  } catch (error) {
    await captureFailure();
    throw error;
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
