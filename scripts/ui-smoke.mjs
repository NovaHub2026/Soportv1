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
import { spawn, spawnSync } from 'node:child_process';
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
/** A real 1×1 PNG so the browser renders the thumbnail (attachments, PH-2.3). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
mkdirSync(OUT, { recursive: true });

if (!process.env.SUPPORT_DB_DIR) {
  console.error('Refusing to run without SUPPORT_DB_DIR (would touch the developer database).');
  process.exit(2);
}
if (!process.env.SUPPORT_UPLOADS_DIR) {
  console.error('Refusing to run without SUPPORT_UPLOADS_DIR (would write uploads into the developer data directory).');
  process.exit(2);
}

const children = [];
// Each server runs in its own process group so shutdown reaches grandchildren (e.g. `next start` → next-server);
// an orphaned server on the port would silently serve a stale build (learned in PH-1.3).
// Windows has no process groups: children run attached and are stopped with taskkill /T (Cycle Audit 1, FND-0019).
const WINDOWS = process.platform === 'win32';
function start(name, cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: !WINDOWS });
  child.on('error', (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    stopAll('SIGKILL');
    process.exit(3);
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  children.push(child);
  return child;
}

function stopChild(child, signal) {
  if (child.exitCode !== null || !child.pid) return;
  if (WINDOWS) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function stopAll(signal) {
  for (const child of children) stopChild(child, signal);
}

async function waitForExit(child, timeoutMs = 10_000) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
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

/**
 * The case reference shown in a customer conversation header, once it is none of `known` (BL-023): references are
 * read from the product, never assumed from the order in which a run creates cases.
 */
async function shownReference(page, known = []) {
  const header = page.getByText(/Referência SUP-\d{6}/).first();
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const text = ((await header.textContent({ timeout: 1000 }).catch(() => '')) ?? '').replace('Referência', '').trim();
    if (/^SUP-\d{6}$/.test(text) && !known.includes(text)) return text;
    await page.waitForTimeout(200);
  }
  throw new Error(`No new case reference appeared (known: ${known.join(', ')})`);
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
  // PH-6.2: fast notification job so the simulated e-mail shows up during the run (delay is set to 0 through settings below).
  let apiChild = start('api', 'node', ['apps/api/dist/main.js'], ROOT, { PORT: String(API_PORT), SUPPORT_NOTIFICATION_INTERVAL_MS: '2000' });
  // The JS entry, not the .bin shim: the shim is a shell script Windows cannot spawn.
  start('web', process.execPath, [`${ROOT}/node_modules/next/dist/bin/next`, 'start', '-p', String(WEB_PORT)], `${ROOT}/apps/web`);
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
    await desktop.getByTestId('availability').waitFor({ timeout: 5000 });
    const availabilityText = await desktop.getByTestId('availability').textContent();
    if (!/Atendimento (aberto|fechado) agora\./.test(availabilityText) || !/Horário padrão de trabalho/.test(availabilityText)) throw new Error(`Availability copy is not honest: ${availabilityText}`);
    note('availability', `the customer home states availability from the configured schedule and labels it a working default: "${availabilityText.trim().slice(0, 90)}…" (PH-5.4)`);
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

    // PH-5.3: a saved reply exists before the staff member opens the case (created through the API, as the panel would).
    const savedReply = await fetch(`${API}/api/staff/saved-replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-simulated-staff-id': 'staff-carla', 'x-simulated-staff-role': 'supervisor', 'x-simulated-staff-name': 'Carla Nunes' },
      body: JSON.stringify({ title: 'Saque em análise', body: 'Seu saque está em análise pelo time financeiro.', category: 'deposits_withdrawals' }),
    });
    if (savedReply.status !== 201) throw new Error(`Saved reply not created: ${savedReply.status}`);

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
    await staffPage.getByLabel('Inserir resposta salva').selectOption({ label: 'Saque em análise' });
    if ((await staffPage.getByLabel('Resposta ao cliente').inputValue()) !== 'Seu saque está em análise pelo time financeiro.') throw new Error('Saved reply was not inserted');
    await staffPage.getByLabel('Resposta ao cliente').fill('');
    note('saved-reply', 'choosing "Saque em análise" in the composer inserted the saved text into the draft without sending; the agent can edit it (PH-5.3)');

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
    // PH-6.1: the reply produced a notification; the conversation is open, so it is already read and the badge stays absent.
    await desktop.waitForTimeout(800);
    if (await desktop.getByTestId('notifications-badge').count()) throw new Error('Notification badge shown although the conversation is open');
    await desktop.getByRole('button', { name: 'Notificações' }).click();
    await desktop.getByRole('button', { name: new RegExp(`Nova resposta em ${reference}`) }).waitFor({ timeout: 5000 });
    await desktop.getByRole('button', { name: 'Notificações' }).click();
    note('notification', `the staff reply created the notification "Nova resposta em ${reference}"; because the conversation was on screen it was marked read at once and no badge appeared (PH-6.1)`);
    await shot(desktop, '04-conversation-reply');

    // The customer has the conversation open, so the reply counts as read — staff see that, live.
    await staffPage.getByText(/Última resposta lida pelo cliente/).waitFor({ timeout: 5000 });
    note('read-receipt', 'staff see "Última resposta lida pelo cliente" once the open customer panel received the reply');

    // PH-4.1: the context column shows the customer's Orbit summary — masked contact, verification, environment — labeled as simulation.
    await staffPage.getByText('Cliente no Orbit').waitFor();
    await staffPage.getByText('a***@e***.com').waitFor({ timeout: 5000 });
    await staffPage.getByText('Verificada').waitFor();
    if (await staffPage.getByText('alice.souza@').count()) throw new Error('Raw e-mail rendered for staff');
    note('orbit-summary', 'the staff context column shows the customer\'s Orbit summary from the simulated adapter: username alice.souza, e-mail masked as a***@e***.com, verification "Verificada", "Conta real" — labeled Simulação; the raw e-mail never appears');
    // A poll that raced the reply must not make the message vanish (regression found in PH-1.4).
    await staffPage.waitForTimeout(2500);
    if (!(await staffPage.getByText(replyText).isVisible())) throw new Error('Staff reply disappeared after a refresh');
    await staffPage.getByText('Atribuído a Ana Ribeiro').waitFor();
    note('staff-reply', 'the public reply stays visible across refreshes; the context column shows the Orbit summary, the pending-records note and the assignment in the history');
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

    // Attachments (PH-2.3): a real PNG is accepted and shown to staff live; a disguised executable is refused.
    await desktop.locator('#customer-attach-input').setInputFiles({ name: 'comprovante.png', mimeType: 'image/png', buffer: TINY_PNG });
    await desktop.getByText('comprovante.png').waitFor();
    await desktop.locator('#customer-attach-input').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('MZ\x90\x00 not an image at all') });
    await desktop.getByText('Tipo não permitido. Envie PNG, JPEG, WebP ou PDF.').waitFor({ timeout: 10_000 });
    note('attachment-refused', 'a file with image name/type but executable bytes is refused by the server and shown as not allowed');
    await desktop.getByRole('button', { name: 'Remover foto.png' }).click();
    await desktop.getByLabel('Sua mensagem').fill('Segue o comprovante em anexo.');
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    await desktop.getByAltText('Imagem anexada: comprovante.png').waitFor({ timeout: 10_000 });
    await staffPage.getByAltText('Imagem anexada: comprovante.png').waitFor({ timeout: 10_000 });
    note('attachment-delivered', 'the PNG attached by the customer appears as a thumbnail in both the customer panel and the staff case view');
    await shot(staffPage, '12-staff-attachment');

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

    // Lifecycle (PH-3.1): waiting for the customer → reply resumes; resolve with explanation → "Ainda preciso de ajuda".
    await desktop.getByRole('button', { name: new RegExp(reference) }).click();
    await staffPage.getByRole('button', { name: 'Aguardar cliente' }).click();
    await desktop.getByText('Aguardando sua resposta').waitFor({ timeout: 5000 });
    await desktop.getByLabel('Sua mensagem').fill('Aqui está a informação que faltava.');
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    await staffPage.getByText('Em atendimento').first().waitFor({ timeout: 5000 });
    note('waiting-customer', 'staff set "Aguardar cliente"; the customer saw "Aguardando sua resposta" and their reply returned the case to "Em atendimento" for staff');

    await staffPage.getByRole('button', { name: 'Resolver caso' }).click();
    await staffPage.getByLabel('Motivo').selectOption('solved');
    const explanation = 'Confirmamos que o saque foi creditado na rede TRC20. Se precisar, é só chamar.';
    await staffPage.getByLabel('Explicação para o cliente').fill(explanation);
    await staffPage.getByRole('button', { name: 'Confirmar resolução' }).click();
    await desktop.getByText('Resolvido', { exact: true }).waitFor({ timeout: 5000 });
    await desktop.getByText(explanation).waitFor({ timeout: 5000 });
    await desktop.getByRole('button', { name: 'Ainda preciso de ajuda' }).waitFor();
    await staffPage.getByText('Resolvido · Problema resolvido').waitFor({ timeout: 5000 });
    await staffPage.getByText('Resolvido: Problema resolvido').waitFor();
    note('resolved', 'staff resolved with reason "Problema resolvido"; the customer saw "Resolvido", the explanation in the conversation and the "Ainda preciso de ajuda" button; the history records the resolution');
    await shot(desktop, '13-customer-resolved');

    await desktop.getByRole('button', { name: 'Ainda preciso de ajuda' }).click();
    await desktop.getByText('Em atendimento').waitFor({ timeout: 5000 });
    await staffPage.getByText('Reaberto pelo cliente').waitFor({ timeout: 5000 });
    await staffPage.getByText('Em atendimento').first().waitFor();
    note('reopened', '"Ainda preciso de ajuda" reactivated the same case: "Em atendimento" on both sides and "Reaberto pelo cliente" in the history');

    // Internal collaboration (PH-3.2): a note stays with the team; a consultation puts the case "Em análise" for the customer.
    const noteText = 'NOTA INTERNA: confirmar hash do saque com o Financeiro.';
    await staffPage.getByLabel('Nota interna', { exact: true }).check({ force: true });
    await staffPage.getByLabel('Nota interna (só a equipe vê)').fill(noteText);
    await staffPage.getByRole('button', { name: 'Salvar nota' }).click();
    await staffPage.getByText(noteText).waitFor({ timeout: 5000 });
    await desktop.waitForTimeout(2000);
    if ((await desktop.getByText(noteText).count()) !== 0) throw new Error('Internal note leaked to the customer panel');
    note('internal-note', 'an internal note appears in the staff conversation and never in the customer panel (checked after a live-update window)');
    await shot(staffPage, '14-staff-note');
    await staffPage.getByLabel('Responder ao cliente', { exact: true }).check({ force: true });

    await staffPage.getByRole('button', { name: 'Consultar equipe' }).click();
    await staffPage.getByLabel('Equipe', { exact: true }).selectOption('finance');
    await staffPage.getByLabel('Pergunta para a equipe').fill(`O saque ${reference} foi liquidado na rede?`);
    await staffPage.getByRole('button', { name: 'Enviar consulta' }).click();
    await staffPage.getByText('1 consulta pendente').waitFor({ timeout: 5000 });
    await desktop.getByText('Em análise').waitFor({ timeout: 5000 });
    note('consultation', 'a consultation to Financeiro shows as pending for staff and the customer sees "Em análise"');
    await staffPage.getByLabel('Resposta da equipe').fill('Sim, liquidado às 14:02.');
    await staffPage.getByRole('button', { name: 'Responder consulta' }).click();
    await staffPage.getByText('Sim, liquidado às 14:02.').waitFor({ timeout: 5000 });
    await desktop.getByText('Em atendimento').waitFor({ timeout: 5000 });
    note('consultation-answered', 'answering the consultation returns the case to "Em atendimento" for the customer');

    // Ownership and attributes (PH-3.3): priority to Alta while Ana owns the case, transfer to Bruno, then Bruno releases and Ana takes it back.
    // Under the role model (PH-7.2) attributes are edited by the owner or a supervisor, so the edit comes before the transfer.
    await staffPage.getByLabel('Prioridade', { exact: true }).selectOption('high');
    await staffPage.getByText('Prioridade: Normal → Alta').waitFor({ timeout: 5000 });
    await staffPage.getByRole('button', { name: 'Transferir', exact: true }).click();
    await staffPage.getByLabel('Transferir para').selectOption('staff-bruno');
    await staffPage.getByRole('button', { name: 'Confirmar transferência' }).click();
    await staffPage.getByText('staff-bruno').first().waitFor({ timeout: 5000 });
    await staffPage.getByText('Transferido para staff-bruno por Ana Ribeiro').waitFor({ timeout: 5000 });
    note('transfer-priority', 'Ana raised the priority to Alta with history and transferred the case to Bruno (history: "Transferido para staff-bruno por Ana Ribeiro")');
    await staffPage.getByTestId('not-owner-hint').waitFor({ timeout: 5000 });
    if (!(await staffPage.getByRole('button', { name: 'Resolver caso' }).isDisabled())) throw new Error('A non-owner agent could still resolve the case');
    note('role-model', 'once the case belongs to Bruno, Ana (agent) sees "Só o responsável ou um supervisor…" and the state actions disabled; replying stays available (PH-7.2, DEC-0029)');
    await shot(staffPage, '15-staff-transferred');

    await staffPage.getByLabel('Atendente simulado').selectOption('staff-bruno');
    await staffPage.getByRole('tab', { name: 'Meus casos' }).click();
    await staffPage.getByRole('button', { name: new RegExp(reference) }).waitFor({ timeout: 10_000 });
    await staffPage.getByRole('button', { name: new RegExp(reference) }).click();
    await staffPage.getByRole('button', { name: 'Devolver à fila' }).click();
    await staffPage.getByText('Devolvido à fila por Bruno Costa').waitFor({ timeout: 5000 });
    await staffPage.getByLabel('Atendente simulado').selectOption('staff-ana');
    await staffPage.getByRole('tab', { name: 'Não atribuídos' }).click();
    await staffPage.getByRole('button', { name: new RegExp(reference) }).waitFor({ timeout: 10_000 });
    await staffPage.getByRole('button', { name: new RegExp(reference) }).click();
    await staffPage.getByRole('button', { name: 'Assumir caso' }).click();
    await staffPage.getByText('staff-ana').first().waitFor({ timeout: 5000 });
    note('release-retake', 'as Bruno the case appeared under "Meus casos" and was returned to the queue; as Ana it reappeared under "Não atribuídos" and was taken again — history preserved throughout');

    // Closure and follow-up (PH-3.4): resolve → close → the customer opens a linked continuation.
    await staffPage.getByRole('button', { name: 'Resolver caso' }).click();
    await staffPage.getByLabel('Motivo').selectOption('answered');
    await staffPage.getByLabel('Explicação para o cliente').fill('Tudo esclarecido por aqui. Vamos encerrar este caso.');
    await staffPage.getByRole('button', { name: 'Confirmar resolução' }).click();
    await staffPage.getByRole('button', { name: 'Encerrar caso' }).click();
    await staffPage.getByText('Encerrado pela equipe').waitFor({ timeout: 5000 });
    await desktop.getByText('Encerrado', { exact: true }).waitFor({ timeout: 5000 });
    await desktop.getByText(/Esta conversa foi encerrada/).waitFor();
    note('closed', 'staff closed the resolved case; the customer sees "Encerrado", the closure notice and the follow-up form instead of the composer');
    // PH-5.1: closed history has its own view; the case is no longer under "Todos ativos".
    await staffPage.getByRole('tab', { name: 'Encerrados' }).click();
    await staffPage.getByRole('button', { name: new RegExp(reference) }).waitFor({ timeout: 5000 });
    await staffPage.getByRole('tab', { name: 'Todos ativos' }).click();
    await staffPage.waitForTimeout(500);
    if (await staffPage.getByRole('button', { name: new RegExp(reference) }).count()) throw new Error('Closed case still listed as active');
    note('history-views', 'the closed case is listed under "Encerrados" and no longer under "Todos ativos" (PH-5.1)');
    await staffPage.getByRole('tab', { name: 'Encerrados' }).click();
    await staffPage.getByRole('button', { name: new RegExp(reference) }).click();
    await desktop.getByLabel('O que ainda precisa').fill('O problema voltou a acontecer hoje.');
    await desktop.getByRole('button', { name: 'Preciso de mais ajuda' }).click();
    const followUpRef = await shownReference(desktop, [reference]);
    await desktop.getByText(`Continuação do caso ${reference}`).first().waitFor();
    await desktop.getByText(`Continuação do caso ${reference}.`, { exact: true }).waitFor();
    note('follow-up', `the customer opened a linked continuation: new reference ${followUpRef}, "Continuação do caso ${reference}" in the header and a system message pointing back`);
    await shot(desktop, '16-customer-follow-up');
    await staffPage.getByRole('tab', { name: 'Não atribuídos' }).click();
    await staffPage.getByRole('button', { name: new RegExp(followUpRef) }).waitFor({ timeout: 10_000 });
    await staffPage.getByRole('button', { name: new RegExp(followUpRef) }).click();
    await staffPage.getByText(`Continuação do caso ${reference}`).first().waitFor({ timeout: 5000 });
    note('follow-up-staff', 'the continuation reached the staff queue with the link to the previous case');

    // Shared incidents (PH-3.5): create and link, broadcast an internal note, mark resolved without touching the case.
    await staffPage.getByRole('button', { name: 'Criar incidente' }).click();
    await staffPage.getByLabel('Título do incidente').fill('Atraso no provedor Pix');
    await staffPage.getByRole('button', { name: 'Criar e vincular' }).click();
    await staffPage.getByText('Atraso no provedor Pix').first().waitFor({ timeout: 5000 });
    await staffPage.getByText('Incidente: Vinculado ao incidente “Atraso no provedor Pix”').waitFor({ timeout: 5000 });
    await staffPage.getByLabel('Nota interna para todos os casos vinculados').fill('Provedor confirmou normalização às 11:20.');
    await staffPage.getByRole('button', { name: 'Enviar nota a todos' }).click();
    await staffPage.getByText('Nota enviada a 1 caso(s) vinculado(s).').waitFor({ timeout: 5000 });
    await staffPage.getByText(/Provedor confirmou normalização/).waitFor({ timeout: 5000 });
    await desktop.waitForTimeout(1500);
    if ((await desktop.getByText(/Provedor confirmou normalização/).count()) !== 0) throw new Error('Incident note leaked to the customer');
    await staffPage.getByRole('button', { name: 'Marcar incidente como resolvido' }).click();
    await staffPage.getByText(/marcado como resolvido por Ana Ribeiro/).waitFor({ timeout: 5000 });
    await staffPage.getByText('Novo').first().waitFor();
    note('incident', `created and linked an incident from ${followUpRef}, broadcast an internal note (not visible to the customer), marked the incident resolved — the case stayed "Novo"`);
    await shot(staffPage, '17-staff-incident');
    await staffPage.close();

    // PH-5.4: supervision — Carla reviews demand, reassigns from the overdue list and saves the schedule.
    const supPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
    await supPage.goto(`${WEB}/staff`);
    await supPage.getByLabel('Atendente simulado').selectOption('staff-carla');
    await supPage.getByRole('button', { name: 'Supervisão' }).click();
    await supPage.getByTestId('overview').waitFor({ timeout: 10_000 });
    await supPage.getByTestId('metrics').waitFor();
    await supPage.getByText(/Não há metas definidas/).waitFor();
    // The threshold is lowered to 1 h so the overdue list is exercised on today's data if any case qualifies; then saved.
    await supPage.getByLabel('Horas sem resposta para considerar atraso').fill('1');
    await supPage.getByLabel('Minutos sem ler uma notificação antes de enviar e-mail (0 = imediato)').fill('0');
    await supPage.getByLabel('Atende em Sábado').check();
    await supPage.getByRole('button', { name: 'Salvar configuração' }).click();
    await supPage.getByText('Configuração salva.').waitFor({ timeout: 5000 });
    await supPage.getByText(/Configurado por Carla Nunes/).waitFor({ timeout: 5000 });
    note('supervision', 'as supervisor, "Supervisão" shows demand (unassigned, awaiting a human reply, per status), load per agent, the overdue list, metrics for the period with the explicit "no targets" note, and the schedule form; saving it records "Configurado por Carla Nunes"');
    await shot(supPage, '23-staff-supervision');
    await supPage.close();
    await desktop.reload();
    await desktop.getByText('Conversas em andamento').waitFor();
    const configured = await desktop.getByTestId('availability').textContent();
    if (!/Horário configurado/.test(configured)) throw new Error(`Customer copy did not pick up the configured schedule: ${configured}`);
    note('availability-configured', 'after the supervisor saved the schedule, the customer home says "Horário configurado (America/Sao_Paulo)" instead of the working-default note (RULE-SUP-08)');


    // Contextual entry from a record (PH-4.2, §4.2): "Preciso de ajuda" on a withdrawal in the host.
    if (await desktop.getByRole('button', { name: 'Voltar' }).count()) await desktop.getByRole('button', { name: 'Voltar' }).click();
    await desktop.getByText('Conversas em andamento').waitFor();
    await desktop.getByRole('button', { name: 'Preciso de ajuda: Saque 250 USDT' }).click();
    await desktop.getByText('Como podemos ajudar?').waitFor();
    await desktop.getByTestId('request-record').getByText('WD-48213').waitFor();
    if (!(await desktop.getByLabel('Depósitos e saques').isChecked())) throw new Error('Topic was not preselected from the record');
    await desktop.getByLabel('Conte o que está acontecendo').fill('Esse saque está em processamento há muito tempo.');
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    const recordRef = await shownReference(desktop, [reference, followUpRef]);
    await desktop.getByTestId('case-record').getByText('Saque 250 USDT').waitFor();
    note('record-entry', `"Preciso de ajuda" on the simulated withdrawal opened a request with the record card, preselected "Depósitos e saques", and the new case ${recordRef} shows the card with the snapshot`);
    await shot(desktop, '18-customer-record-case');
    const staffPage2 = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
    await staffPage2.goto(`${WEB}/staff`);
    await staffPage2.getByRole('tab', { name: 'Não atribuídos' }).click();
    await staffPage2.getByRole('button', { name: new RegExp(recordRef) }).waitFor({ timeout: 10_000 });
    await staffPage2.getByRole('button', { name: new RegExp(recordRef) }).click();
    await staffPage2.getByTestId('staff-case-record').getByText('TX7f…9k2Q').waitFor({ timeout: 5000 });
    await staffPage2.getByTestId('orbit-record-current').getByText('Em processamento').waitFor({ timeout: 5000 });
    note('record-staff', 'staff see the withdrawal card with the masked destination captured at opening and the record\'s current state from the simulated Orbit');
    // PH-5.2: search finds the case by record reference and by customer id.
    await staffPage2.getByRole('tab', { name: 'Todos ativos' }).click();
    await staffPage2.getByRole('searchbox', { name: 'Buscar casos' }).fill('WD-48213');
    // The search is debounced: wait until the other active case has left the list.
    await staffPage2.getByRole('button', { name: new RegExp(followUpRef) }).waitFor({ state: 'detached', timeout: 5000 });
    await staffPage2.getByRole('button', { name: new RegExp(recordRef) }).waitFor({ timeout: 5000 });
    await staffPage2.getByRole('searchbox', { name: 'Buscar casos' }).fill('nada-disso');
    await staffPage2.getByText('Nenhum caso ativo no momento.').waitFor({ timeout: 5000 });
    await staffPage2.getByRole('button', { name: 'Limpar' }).click();
    note('search', `searching "WD-48213" under "Todos ativos" lists only ${recordRef}; an unknown term shows the honest empty state; "Limpar" restores the list (PH-5.2)`);
    await shot(staffPage2, '19-staff-record-case');
    await staffPage2.close();
    // Asking again about the same record suggests continuing its active case instead of opening a duplicate.
    await desktop.getByRole('button', { name: 'Voltar' }).click();
    await desktop.getByRole('button', { name: 'Preciso de ajuda: Saque 250 USDT' }).click();
    await desktop.getByText(`já tem uma conversa em andamento (${recordRef})`).waitFor({ timeout: 5000 });
    await desktop.getByRole('button', { name: 'Continuar conversa' }).click();
    await desktop.getByText(`Referência ${recordRef}`).waitFor();
    note('record-continue', `asking for help about the same record again offered to continue ${recordRef}, and "Continuar conversa" opened it`);

    // PH-6.2: Bruno has no panel open; a staff reply to his case is unread, so the job e-mails it (simulated outbox).
    const brunoCase = await fetch(`${API}/api/support/cases`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-simulated-customer-id': 'cust-bruno' }, body: JSON.stringify({ category: 'operations', message: 'Minha operação não liquidou.' }) });
    if (brunoCase.status !== 201) throw new Error('Bruno case not created');
    const brunoCaseBody = await brunoCase.json();
    const staffReply = await fetch(`${API}/api/staff/cases/${brunoCaseBody.id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-simulated-staff-id': 'staff-ana', 'x-simulated-staff-name': 'Ana Ribeiro' }, body: JSON.stringify({ body: 'Verifiquei: a operação liquidou às 15:31 com perda.' }) });
    if (staffReply.status !== 201) throw new Error('Staff reply to Bruno not created');
    const outboxDeadline = Date.now() + 15_000;
    let outbox = [];
    while (Date.now() < outboxDeadline) {
      const res = await fetch(`${API}/api/support/emails`, { headers: { 'x-simulated-customer-id': 'cust-bruno' } });
      // Outside the schedule the case also gets an outside-hours acknowledgement e-mail (PH-6.3); count only the reply.
      outbox = (await res.json()).emails.filter((e) => e.kind === 'staff_reply');
      if (outbox.length > 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (outbox.length !== 1) throw new Error('Simulated e-mail was not produced for the unread reply');
    if (outbox[0].subject.indexOf(brunoCaseBody.reference) === -1 || JSON.stringify(outbox).indexOf('liquidou') !== -1) throw new Error('E-mail content is wrong or leaks the reply');
    await desktop.getByLabel('Conta simulada').selectOption('cust-bruno');
    await desktop.getByTestId('email-outbox').getByText(new RegExp(`Nova resposta no seu caso ${brunoCaseBody.reference}`)).waitFor({ timeout: 5000 });
    await desktop.getByTestId('notifications-badge').waitFor({ timeout: 5000 });
    note('email-simulated', `a staff reply to Bruno (panel closed) stayed unread; within seconds the notification job produced the simulated e-mail "Nova resposta no seu caso ${brunoCaseBody.reference}" to b***@e***.com with a link and no reply text; Bruno's home lists it under "E-mails que seriam enviados" (Simulação) and the host shows the unread badge (PH-6.1/6.2)`);
    await shot(desktop, '24-customer-email-outbox');
    await desktop.getByLabel('Conta simulada').selectOption('cust-alice');
    await desktop.getByText('Conversas em andamento').waitFor();
    // PH-6.3: with every day closed, a customer who writes gets the honest outside-hours notice in the conversation.
    const supervisorHeaders = { 'content-type': 'application/json', 'x-simulated-staff-id': 'staff-carla', 'x-simulated-staff-role': 'supervisor', 'x-simulated-staff-name': 'Carla Nunes' };
    const settingsNow = await (await fetch(`${API}/api/staff/settings`, { headers: supervisorHeaders })).json();
    const closedSchedule = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    if ((await fetch(`${API}/api/staff/settings`, { method: 'PUT', headers: supervisorHeaders, body: JSON.stringify({ ...settingsNow, schedule: closedSchedule }) })).status !== 200) throw new Error('Could not close the schedule');
    await desktop.getByLabel('Conta simulada').selectOption('cust-carla');
    await desktop.getByText(/Atendimento fechado agora\./).waitFor({ timeout: 5000 });
    await desktop.getByRole('button', { name: 'Falar com o suporte' }).click();
    await desktop.getByText('Outro assunto', { exact: true }).click();
    await desktop.getByLabel('Conte o que está acontecendo').fill('Escrevo fora do horário.');
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    await desktop.getByText(/Fora do horário de atendimento\. Registramos sua mensagem/).waitFor({ timeout: 10_000 });
    await desktop.getByText('Aviso', { exact: true }).first().waitFor({ timeout: 5000 }); // the notice is labeled as a system notice, never as a staff reply (FND-0050)
    note('outside-hours', 'with the schedule closed on every day, Carla\'s new case received the system notice "Fora do horário de atendimento. Registramos sua mensagem…" as an "Aviso" (never a staff reply), and her home said "Atendimento fechado agora." (PH-6.3)');
    await shot(desktop, '25-customer-outside-hours');
    if ((await fetch(`${API}/api/staff/settings`, { method: 'PUT', headers: supervisorHeaders, body: JSON.stringify(settingsNow) })).status !== 200) throw new Error('Could not restore the schedule');
    await desktop.getByLabel('Conta simulada').selectOption('cust-alice');
    await desktop.getByText('Conversas em andamento').waitFor();

    // PH-9.3 (Cycle Audit 3 FND-0094): a file on the very first message (BL-010) and the desktop close control (BL-015).
    await desktop.getByRole('button', { name: 'Falar com o suporte' }).click();
    await desktop.getByText('Outro assunto', { exact: true }).click();
    await desktop.getByLabel('Conte o que está acontecendo').fill('Segue o print do erro que aparece na tela.');
    await desktop.getByLabel('Anexar arquivo').setInputFiles({ name: 'print-erro.png', mimeType: 'image/png', buffer: TINY_PNG });
    await desktop.locator('li[data-state="ready"]', { hasText: 'print-erro.png' }).waitFor({ timeout: 10_000 });
    await desktop.getByRole('button', { name: 'Enviar' }).click();
    const attachedRef = await shownReference(desktop, [reference, followUpRef, recordRef]);
    await desktop.getByAltText(/print-erro\.png/).waitFor({ timeout: 10_000 });
    note('first-message-attachment', `a new request carried a PNG on its very first message: the chip was ready before any case existed and ${attachedRef} opened with the image on message 1 (PH-9.3, BL-010)`);
    await shot(desktop, '30-customer-first-message-attachment');
    await desktop.getByTestId('support-panel').getByRole('button', { name: 'Fechar suporte' }).click();
    await desktop.locator('#support-panel').waitFor({ state: 'hidden' });
    note('desktop-close', 'on desktop "×" hid the side panel and the trading area took the whole width; the topbar then offered "Suporte", which brought it back (PH-9.3, BL-015)');
    await shot(desktop, '31-desktop-panel-closed');
    await desktop.getByRole('button', { name: 'Suporte', exact: true }).click();
    await desktop.locator('#support-panel').waitFor({ state: 'visible' });
    await desktop.getByRole('button', { name: 'Voltar' }).click();
    await desktop.getByText('Conversas em andamento').waitFor();

    // PH-7.1: "Não consigo acessar minha conta" from the host, without any session; staff handle it in their own page.
    await desktop.getByRole('button', { name: 'Não consigo acessar minha conta' }).click();
    await desktop.getByLabel(/E-mail ou telefone/).fill('recupera@example.com');
    await desktop.getByLabel(/O que está acontecendo/).fill('O código de verificação nunca chega no meu telefone.');
    await desktop.getByRole('button', { name: 'Enviar pedido' }).click();
    await desktop.getByTestId('recovery-reference').waitFor({ timeout: 10_000 });
    const recoveryReference = (await desktop.getByTestId('recovery-reference').textContent()).trim();
    if (!/^REC-\d{6}$/.test(recoveryReference)) throw new Error(`Unexpected recovery reference: ${recoveryReference}`);
    note('access-recovery', `the host offers "Não consigo acessar minha conta" without any session; the form never asks for a password or code, and the receipt shows ${recoveryReference} with the next step (Orbit's verification process, labeled as simulated) and no account data (PH-7.1, §4.5)`);
    await shot(desktop, '26-access-recovery-receipt');
    await desktop.getByRole('button', { name: 'Voltar' }).click();
    const recoveryStaff = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
    await recoveryStaff.goto(`${WEB}/staff`);
    await recoveryStaff.getByRole('button', { name: 'Recuperação de acesso' }).click();
    await recoveryStaff.getByText(new RegExp(recoveryReference)).first().waitFor({ timeout: 5000 });
    await recoveryStaff.getByLabel('Observação (opcional)').fill('Retornei por e-mail.');
    await recoveryStaff.getByRole('button', { name: 'Encaminhar ao processo de verificação' }).click();
    await recoveryStaff.getByText(new RegExp(`${recoveryReference} encaminhado`)).waitFor({ timeout: 5000 });
    await recoveryStaff.getByLabel('Mostrar').selectOption('forwarded'); // the status filter, not the agent picker
    await recoveryStaff.getByText(/Tratado por Ana Ribeiro/).waitFor({ timeout: 5000 });
    note('access-recovery-staff', `staff saw ${recoveryReference} under "Recuperação de acesso" with the unverified contact and the description, recorded "Encaminhar ao processo de verificação" (labeled simulation) with a note, and the outcome is attributed to Ana with its time (PH-7.1)`);
    await shot(recoveryStaff, '27-staff-access-recovery');
    await recoveryStaff.close();

    // Continuity: reload, history still there.
    await desktop.reload();
    await desktop.getByText('Conversas em andamento').waitFor();
    // The outbox may also mention the reference (PH-6.2), so match the first case item only.
    await desktop.getByRole('button', { name: new RegExp(reference) }).first().waitFor();
    note('continuity', 'after reload the case is listed under "Conversas em andamento" with its reference');
    await shot(desktop, '05-home-with-case');

    // Privacy at the UI: another simulated customer sees nothing (RULE-SUP-01).
    await desktop.getByLabel('Conta simulada').selectOption('cust-bruno');
    await desktop.getByRole('button', { name: new RegExp(brunoCaseBody.reference) }).first().waitFor();
    if (await desktop.getByText(new RegExp(reference)).count()) throw new Error('Another customer can see Alice\'s case');
    note('privacy', 'switching to another simulated customer shows only his own history (Bruno\'s case), never Alice\'s case');
    await shot(desktop, '06-other-customer-empty');

    // PH-7.3: "Sair" on a shared device leaves a neutral picker; a reload keeps it; "Entrar" starts clean.
    await desktop.getByRole('button', { name: 'Sair' }).click();
    await desktop.getByTestId('signed-out').waitFor({ timeout: 5000 });
    await desktop.getByText('Você saiu. Este dispositivo não mostra mais suas conversas.').waitFor();
    if ((await desktop.getByText('Conversas em andamento').count()) !== 0 || (await desktop.getByText(/SUP-0000/).count()) !== 0) throw new Error('Case data visible after sign-out');
    await desktop.reload();
    await desktop.getByTestId('signed-out').waitFor({ timeout: 10_000 });
    if ((await desktop.getByRole('button', { name: /Notificações/ }).count()) !== 0) throw new Error('Notifications bell visible after sign-out');
    note('sign-out', 'after "Sair" the host shows only "Quem está usando este dispositivo?" (labeled simulation) with the recovery link; no case, notification, record or draft of the previous customer survives a reload (PH-7.3, §10.2)');
    await shot(desktop, '28-signed-out');
    await desktop.getByLabel('Conta simulada').selectOption('cust-alice');
    await desktop.getByRole('button', { name: 'Entrar' }).click();
    await desktop.getByText('Conversas em andamento').waitFor({ timeout: 10_000 });
    const staffExit = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
    await staffExit.goto(`${WEB}/staff`);
    await staffExit.getByRole('button', { name: 'Sair' }).click();
    await staffExit.getByTestId('staff-signed-out').waitFor({ timeout: 5000 });
    if ((await staffExit.getByRole('tab', { name: 'Não atribuídos' }).count()) !== 0) throw new Error('Queue visible after staff sign-out');
    note('staff-sign-out', 'the staff workspace has the same "Sair": the queue and the open case disappear and a neutral "Quem está usando esta estação?" picker remains (PH-7.3)');
    await shot(staffExit, '29-staff-signed-out');
    await staffExit.getByLabel('Atendente simulado').selectOption('staff-ana');
    await staffExit.getByRole('button', { name: 'Entrar' }).click();
    await staffExit.getByRole('tab', { name: 'Não atribuídos' }).waitFor({ timeout: 5000 });
    await staffExit.close();
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

    // ---- PH-4.3: honesty when Orbit cannot answer (RULE-SUP-07, §14 item 7) ----
    // (f) A record the boundary cannot find still opens the case — as an investigation, with the reason on the card.
    const ghost = await fetch(`${API}/api/support/cases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-simulated-customer-id': 'cust-alice' },
      body: JSON.stringify({ category: 'deposits_withdrawals', message: 'Não encontro este saque na minha conta.', record: { kind: 'withdrawal', reference: 'WD-000000' } }),
    });
    if (ghost.status !== 201) throw new Error(`Ghost-record case not created: ${ghost.status}`);
    const ghostCase = await ghost.json();
    if (ghostCase.record?.lookupReason !== 'not_found') throw new Error('Ghost record should be marked not_found');
    const honest = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
    await honest.goto(WEB);
    await honest.getByLabel('Conta simulada').selectOption('cust-alice');
    await honest.getByRole('button', { name: new RegExp(ghostCase.reference) }).click();
    await honest.getByTestId('case-record').getByText(/Registro não encontrado no Orbit/).waitFor({ timeout: 5000 });
    note('record-not-found', `a case about a record the simulated Orbit cannot find (WD-000000, ${ghostCase.reference}) shows "Registro não encontrado no Orbit… A equipe vai investigar." on the card instead of an assumed state`);
    await shot(honest, '20-customer-record-not-found');
    const honestStaff = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
    await honestStaff.goto(`${WEB}/staff`);
    await honestStaff.getByRole('tab', { name: 'Não atribuídos' }).click();
    await honestStaff.getByRole('button', { name: new RegExp(ghostCase.reference) }).click();
    await honestStaff.getByTestId('staff-case-record').getByText(/Registro não encontrado no Orbit/).waitFor({ timeout: 5000 });
    await honestStaff.getByTestId('orbit-record-current').getByText(/cliente não encontrado no Orbit|Estado atual indisponível/).waitFor({ timeout: 5000 });
    await honestStaff.getByTestId('orbit-not-integrated').getByText('Saldos e movimentos').waitFor();
    note('record-not-found-staff', 'staff see the same not-found card, "Estado atual indisponível" for the record, and the subjects not integrated yet listed as unavailable — never as zero');

    // (b) Orbit outage: restart the API with the simulated adapter in outage mode; cases and snapshots stay usable.
    stopChild(apiChild, 'SIGTERM');
    await waitForExit(apiChild);
    apiChild = start('api', 'node', ['apps/api/dist/main.js'], ROOT, { PORT: String(API_PORT), SUPPORT_SIMULATED_ORBIT: 'unavailable' });
    await waitForHttp(`${API}/api/health`);
    await honestStaff.reload();
    await honestStaff.getByRole('tab', { name: 'Não atribuídos' }).click();
    await honestStaff.getByRole('button', { name: new RegExp(recordRef) }).click();
    await honestStaff.getByText(/Dados do Orbit indisponíveis: Orbit sem resposta/).waitFor({ timeout: 10_000 });
    await honestStaff.getByRole('button', { name: 'Tentar novamente' }).first().waitFor();
    await honestStaff.getByTestId('staff-case-record').getByText('TX7f…9k2Q').waitFor();
    await honestStaff.getByText('Meu saque em USDT ainda não chegou na carteira.').first().waitFor({ timeout: 5000 }).catch(() => {});
    note('orbit-outage-staff', 'with the simulated Orbit down, the staff context says "Dados do Orbit indisponíveis: Orbit sem resposta." with "Tentar novamente", while the case, its conversation and the snapshot captured at opening stay usable');
    await shot(honestStaff, '21-staff-orbit-outage');
    await honest.reload();
    await honest.getByText('Registros indisponíveis no momento.').waitFor({ timeout: 10_000 });
    await honest.getByRole('button', { name: new RegExp(recordRef) }).click();
    await honest.getByTestId('case-record').getByText('Saque 250 USDT').waitFor();
    note('orbit-outage-customer', `the host says "Registros indisponíveis no momento." instead of an empty list, and the customer still opens ${recordRef} with the card from the snapshot`);
    await shot(honest, '22-customer-orbit-outage');
    await honestStaff.close();
    await honest.close();
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
