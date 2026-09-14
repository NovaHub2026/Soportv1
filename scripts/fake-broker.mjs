/**
 * A SIMULATED broker for the local integration demo (PH-13.3, DEC-0047): the few endpoints of the Optaqode /
 * "Orbit Market" API that Orbit Support's `optaqode` adapters use, with the wire shapes transcribed from the
 * broker's frontend (docs/integration/ORBIT-INTEGRATION.md), plus a host page that does what the broker's app
 * will do: keep the customer's token in the `optaqode.app.token` cookie, mount `/embed` in an iframe and hand the
 * token over with postMessage (docs/integration/broker-host/OrbitSupportPanel.tsx, in plain JS here).
 *
 * This is a stand-in, never a proof of a connected capability (PROJECT_CONTEXT.md §11, §14 item 10): every
 * answer is fictional and the page says so.
 *
 *   node scripts/fake-broker.mjs            # 127.0.0.1:3005 (FAKE_BROKER_PORT); panel origin SUPPORT_PANEL_ORIGIN (default http://127.0.0.1:3000)
 *
 * Customer tokens: `demo-token-<customer id>[-<n>]` (the host page mints them; "-<n>" imitates a refresh);
 * `expired` is always refused. Service account: FAKE_SERVICE_EMAIL / FAKE_SERVICE_PASSWORD
 * (default support-bot@local.test / local-demo); its access token is a JWT-shaped string with an `exp` so the
 * API's refresh logic runs for real.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_BROKER_PORT ?? 3005);
const PANEL_ORIGIN = (process.env.SUPPORT_PANEL_ORIGIN ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const SERVICE_EMAIL = process.env.FAKE_SERVICE_EMAIL ?? 'support-bot@local.test';
const SERVICE_PASSWORD = process.env.FAKE_SERVICE_PASSWORD ?? 'local-demo';
const TOKEN_TTL_S = Number(process.env.FAKE_TOKEN_TTL_S ?? 3600);

// ---- fictional data (the same people as the simulated shell, in the broker's shapes) ----
const profile = (id, code, first, last, email, phone, status, kyc, language, country, createdAt, extra = {}) => ({
  id,
  user_code: code,
  tenant_id: 'TEN_orbitmarket_local',
  email,
  email_verified: true,
  phone_normalized: phone,
  phone_verified: Boolean(phone),
  country,
  first_name: first,
  last_name: last,
  full_name: `${first} ${last}`,
  username: `${first}.${last}`.toLowerCase(),
  language,
  timezone: 'America/Sao_Paulo',
  status,
  kyc_status_cache: kyc,
  vip_level: 'beginner',
  created_at: createdAt,
  security: { level: 'medium', email_verified: true, phone_verified: Boolean(phone), two_factor_enabled: false, identity_verified: kyc === 'approved', identity_status: kyc },
  ...extra,
});

const CUSTOMERS = {
  PRF_DEMO_ALICE: {
    person: profile('PRF_DEMO_ALICE', '104233', 'Alice', 'Souza', 'alice.souza@example.com', '+5511999991234', 'active', 'approved', 'pt-BR', 'BR', '2025-11-03T14:12:00.000Z'),
    wallets: [{ id: 'WAL_DEMO_A1', tenant_id: 'TEN_orbitmarket_local', person_id: 'PRF_DEMO_ALICE', wallet_type: 'REAL', currency: 'USDT', status: 'active', available_balance: '48.50', blocked_balance: '0.00' }],
    deposits: [
      { id: 'dep_9c1f2e3d4b5a6978a0b1', status: 'confirmed', amount: '250.00', currency: 'BRL', receive_amount: '48.50', quote_currency: 'USDT', method: 'pix', provider: 'psp-demo', created_at: '2026-09-10T12:00:00.000Z' },
      { id: 'dep_11aa22bb33cc44dd55ee', status: 'pending', amount: '100.00', currency: 'BRL', receive_amount: '19.40', quote_currency: 'USDT', method: 'pix', provider: 'psp-demo', created_at: '2026-09-14T09:10:00.000Z' },
    ],
    withdrawals: [{ id: 'wd_48213aabbccddeeff001', status: 'processing', requested_amount: '20.00', requested_currency: 'USDT', fee_amount: '0.40', final_amount: '19.60', receive_currency: 'BRL', created_at: '2026-09-12T09:30:00.000Z' }],
    operations: [{ id: 'op_901223aabbccddeeff00', tenant_id: 'TEN_orbitmarket_local', person_id: 'PRF_DEMO_ALICE', wallet_id: 'WAL_DEMO_A1', asset: 'EURUSD', status: 'SETTLED_WIN', direction: 'CALL', stake: '10.00', payout_rate: '0.85', result: 'WIN', profit_amount: '8.50', currency: 'USDT', open_price: '1.0850', close_price: '1.0862', opened_at: '2026-09-11T15:00:00.000Z', expires_at: '2026-09-11T15:05:00.000Z', settled_at: '2026-09-11T15:05:01.000Z' }],
    bonuses: [],
  },
  PRF_DEMO_BRUNO: {
    person: profile('PRF_DEMO_BRUNO', '104788', 'Bruno', 'Lima', 'bruno.lima@example.com', null, 'active', 'pending', 'pt-BR', 'BR', '2026-02-18T09:40:00.000Z'),
    wallets: [{ id: 'WAL_DEMO_B1', tenant_id: 'TEN_orbitmarket_local', person_id: 'PRF_DEMO_BRUNO', wallet_type: 'REAL', currency: 'USDT', status: 'active', available_balance: '0.00', blocked_balance: '0.00' }],
    deposits: [],
    withdrawals: [],
    operations: [],
    bonuses: [],
  },
  PRF_DEMO_CARLA: {
    person: profile('PRF_DEMO_CARLA', '105102', 'Carla', 'Mendes', 'carla.mendes@example.com', '+5491155559876', 'restricted', 'none', 'es-ES', 'AR', '2026-07-30T18:05:00.000Z'),
    wallets: [{ id: 'WAL_DEMO_C1', tenant_id: 'TEN_orbitmarket_local', person_id: 'PRF_DEMO_CARLA', wallet_type: 'DEMO', currency: 'USDT', status: 'active', available_balance: '10000.00', blocked_balance: '0.00' }],
    deposits: [],
    withdrawals: [],
    operations: [{ id: 'op_901300ffeeddccbbaa99', tenant_id: 'TEN_orbitmarket_local', person_id: 'PRF_DEMO_CARLA', wallet_id: 'WAL_DEMO_C1', asset: 'BTCUSD', status: 'OPEN', direction: 'PUT', stake: '25.00', payout_rate: '0.80', result: null, profit_amount: null, currency: 'USDT', open_price: '64120.5', close_price: null, opened_at: '2026-09-14T11:58:00.000Z', expires_at: '2026-09-14T12:03:00.000Z', settled_at: null }],
    bonuses: [],
  },
};

const TEAM = [
  { id: 'PRF_DEMO_STAFF_ANA', name: 'Ana Ribeiro', email: 'ana@local.test', role: 'auditor', status: 'active' },
  { id: 'PRF_DEMO_STAFF_CARLA', name: 'Carla Nunes', email: 'carla@local.test', role: 'admin', status: 'active' },
  { id: 'PRF_DEMO_STAFF_DANI', name: 'Dani Alves', email: 'dani@local.test', role: 'super_admin', status: 'active' },
  { id: 'PRF_DEMO_SUPPORT_BOT', name: 'Orbit Support (service)', email: SERVICE_EMAIL, role: 'auditor', status: 'active' },
];

// ---- tokens ----
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const serviceTokens = new Set();
let issued = 0;
function mintServiceToken() {
  issued += 1;
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'PRF_DEMO_SUPPORT_BOT', authContext: 'admin', exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S, iat: Math.floor(Date.now() / 1000), n: issued })}.fake`;
  serviceTokens.add(token);
  return token;
}
const REFRESH = 'svc-refresh-local';
const customerOf = (token) => {
  const m = /^demo-token-(PRF_DEMO_[A-Z]+)(?:-\d+)?$/.exec(token ?? '');
  return m && CUSTOMERS[m[1]] ? m[1] : null;
};
const bearer = (req) => (/^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '') ?? [])[1] ?? null;

// ---- helpers ----
function send(res, status, body, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(text);
}
const error = (res, status, code, message) => send(res, status, { error_code: code, message, statusCode: status });
async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    return {};
  }
}
function requireService(req, res) {
  const token = bearer(req);
  if (!token || !serviceTokens.has(token)) {
    error(res, 401, 'AUTH_SESSION_INVALID', 'service token missing, unknown or rotated');
    return false;
  }
  return true;
}

// ---- the host page (what the broker's app will do) ----
const HOST_PAGE = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Orbit Market — broker SIMULADO</title>
<style>
  :root{color-scheme:dark;--bg:#000;--card:#0d0d0d;--hover:#191c20;--primary:#0f5efc;--text:#f4f7ff;--muted:#838a97;--orange:#ff7900}
  body{margin:0;background:var(--bg);color:var(--text);font:15px Inter,system-ui,sans-serif}
  header{display:flex;align-items:center;gap:16px;height:4.5rem;padding:0 20px;border-bottom:1px solid #202020;background:var(--card)}
  header .brand{font-weight:700;letter-spacing:.02em} header .sim{color:var(--orange);font-size:12px;border:1px solid var(--orange);border-radius:6px;padding:2px 6px}
  header .spacer{flex:1} header select,header button{background:var(--hover);color:var(--text);border:1px solid #202020;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer}
  header button.primary{background:var(--primary);border-color:var(--primary)}
  main{padding:24px;color:var(--muted);max-width:720px} main h1{color:var(--text);font-size:20px}
  aside{position:fixed;right:0;top:4.5rem;bottom:0;width:min(420px,100vw);border-left:1px solid #202020;background:#000;display:none} aside.open{display:block}
  aside iframe{border:0;width:100%;height:100%;background:#000}
  #log{font:12px ui-monospace,monospace;color:var(--muted);white-space:pre-wrap;margin-top:16px;max-height:40vh;overflow:auto}
</style></head>
<body>
<header>
  <span class="brand">Orbit Market</span><span class="sim">broker SIMULADO</span>
  <span class="spacer"></span>
  <label>Cliente <select id="who">
    <option value="PRF_DEMO_ALICE">Alice Souza (#104233)</option>
    <option value="PRF_DEMO_BRUNO">Bruno Lima (#104788)</option>
    <option value="PRF_DEMO_CARLA">Carla Mendes (#105102)</option>
    <option value="">— sem sessão —</option>
  </select></label>
  <button id="refresh" title="Imita a renovação do token pelo broker">Renovar token</button>
  <button id="expire" title="Coloca um token inválido no cookie: o painel deve pedir outro">Token expirado</button>
  <button id="toggle" class="primary">Suporte</button>
</header>
<main>
  <h1>Página anfitriã simulada</h1>
  <p>Esta página faz o que a app do broker fará: guarda o token do cliente no cookie <code>optaqode.app.token</code>, monta o painel de suporte (<code>${PANEL_ORIGIN}/embed</code>) num iframe e entrega o token por <code>postMessage</code>. Nada aqui é real: identidade, registros e e-mail são simulados (DEC-0003, DEC-0047).</p>
  <div id="log" aria-live="polite"></div>
</main>
<aside id="panel"><iframe id="frame" title="Suporte" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" referrerpolicy="strict-origin-when-cross-origin"></iframe></aside>
<script>
(function () {
  var PANEL = ${JSON.stringify(PANEL_ORIGIN)};
  var COOKIE = 'optaqode.app.token';
  var logEl = document.getElementById('log');
  var who = document.getElementById('who');
  var panel = document.getElementById('panel');
  var frame = document.getElementById('frame');
  var n = 0;
  function log(line) { logEl.textContent = new Date().toLocaleTimeString() + '  ' + line + '\\n' + logEl.textContent; }
  function readCookie() { var m = document.cookie.split('; ').filter(function (c) { return c.indexOf(COOKIE + '=') === 0; })[0]; return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null; }
  function writeCookie(value) { document.cookie = value === null ? COOKIE + '=; path=/; max-age=0' : COOKIE + '=' + encodeURIComponent(value) + '; path=/; samesite=lax'; }
  function post(message) { if (frame.contentWindow) frame.contentWindow.postMessage(message, PANEL); log('host → painel: ' + message.type); }
  function sendSession() { var token = readCookie(); post(token ? { type: 'orbit-support:session', token: token, name: who.options[who.selectedIndex].text } : { type: 'orbit-support:signout' }); }
  function setCustomer() { var id = who.value; writeCookie(id ? 'demo-token-' + id : null); log(id ? 'sessão do broker: ' + id : 'sem sessão'); sendSession(); }
  who.addEventListener('change', setCustomer);
  document.getElementById('refresh').addEventListener('click', function () { if (!who.value) return; n += 1; writeCookie('demo-token-' + who.value + '-' + n); log('token renovado pelo broker'); sendSession(); });
  document.getElementById('expire').addEventListener('click', function () { writeCookie('expired'); log('cookie com token inválido'); sendSession(); });
  document.getElementById('toggle').addEventListener('click', function () {
    var open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (open && !frame.src) frame.src = PANEL + '/embed';
  });
  window.addEventListener('message', function (event) {
    if (event.origin !== PANEL || !event.data || typeof event.data !== 'object') return;
    log('painel → host: ' + event.data.type + (event.data.customerId ? ' (' + event.data.customerId + ')' : ''));
    if (event.data.type === 'orbit-support:ready' || event.data.type === 'orbit-support:token-required') sendSession();
    if (event.data.type === 'orbit-support:close') panel.classList.remove('open');
  });
  if (!readCookie()) writeCookie('demo-token-' + who.value);
  log('pronto — abra "Suporte"');
})();
</script>
</body></html>`;

// ---- the server ----
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const log = (line) => console.log(`[fake-broker] ${req.method} ${path} → ${line}`);
  if (req.method === 'GET' && path === '/') return send(res, 200, HOST_PAGE);
  if (req.method === 'GET' && path === '/health') return send(res, 200, { status: 'ok', broker: 'simulated', customers: Object.keys(CUSTOMERS) });
  if (!path.startsWith('/api/v1/')) return error(res, 404, 'NOT_FOUND', 'no such route');
  const route = path.slice('/api/v1'.length);

  if (req.method === 'GET' && route === '/profiles/me') {
    const id = customerOf(bearer(req));
    if (!id) {
      log('401 (customer token missing, expired or unknown)');
      return error(res, 401, 'AUTH_SESSION_INVALID', 'session invalid');
    }
    log(`profile of ${id}`);
    return send(res, 200, CUSTOMERS[id].person);
  }
  if (req.method === 'POST' && route === '/admin/auth/login') {
    const body = await readJson(req);
    if (body.email !== SERVICE_EMAIL || body.password !== SERVICE_PASSWORD) {
      log('401 (bad service credentials)');
      return error(res, 401, 'AUTH_INVALID_CREDENTIALS', 'invalid credentials');
    }
    log('service account logged in');
    return send(res, 200, { access_token: mintServiceToken(), refresh_token: REFRESH, expires_in: TOKEN_TTL_S });
  }
  if (req.method === 'POST' && route === '/auth/refresh') {
    const body = await readJson(req);
    if (body.refreshToken !== REFRESH) {
      log('401 (unknown refresh token)');
      return error(res, 401, 'AUTH_SESSION_INVALID', 'refresh refused');
    }
    log('service token refreshed');
    return send(res, 200, { accessToken: mintServiceToken(), refreshToken: REFRESH, expiresIn: TOKEN_TTL_S });
  }
  if (req.method === 'GET' && route.startsWith('/admin/rastreio/')) {
    if (!requireService(req, res)) return log('401 (service token)');
    const id = decodeURIComponent(route.slice('/admin/rastreio/'.length));
    if (!CUSTOMERS[id]) {
      log(`404 (${id})`);
      return error(res, 404, 'NOT_FOUND', 'user not found');
    }
    log(`rastreio of ${id}`);
    return send(res, 200, CUSTOMERS[id]);
  }
  if (req.method === 'GET' && route.startsWith('/admin/team-members')) {
    if (!requireService(req, res)) return log('401 (service token)');
    log(`team members (${TEAM.length})`);
    return send(res, 200, { items: TEAM, pagination: { page: 1, limit: 100, total_items: TEAM.length, total_pages: 1 } });
  }
  log('404');
  return error(res, 404, 'NOT_FOUND', 'no such route in the simulated broker');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fake-broker] SIMULATED broker on http://127.0.0.1:${PORT} — host page at /, API under /api/v1 (service account ${SERVICE_EMAIL}); panel origin ${PANEL_ORIGIN}`);
});
