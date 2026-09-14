# Orbit (Optaqode) integration map
Type: INTEGRATION CONTEXT
Status: CURRENT — prepared, not connected (PH-13.1); the live connection waits for the backend answers in §7
Source of truth inspected: the broker's frontend repository `optaqode-frontend2.0` (Next.js 16 / React 19, five platforms by subdomain — `app`, `admin`, `core`, `affiliate`, `integrations`), read-only on 2026-09-14 at the Owner's request. No backend code, OpenAPI document or environment was available: every contract below is what that frontend sends and expects, and is marked as such. Nothing in that repository was modified.
Owner's instruction: «analizalo solo en modo lectura para buscar las integraciones que faltan para nuestro proyecto y ya dejarlo preparado para integrar mas adelante» (2026-09-14).

## 1. What Orbit Support needs from the broker, and what exists
| Need (ADR-0002 boundary) | Port here | The broker today (from its frontend) | Prepared in PH-13.1 |
|---|---|---|---|
| Who the customer is | `OrbitIdentityPort` (`apps/api/src/identity/identity.types.ts`) | Access token = JWT in the cookie `optaqode.app.token` (readable by the page: `httpOnly: false`), refresh token `httpOnly`; sent as `Authorization: Bearer`; refreshed by the page through `POST /api/auth/refresh` (a Next route of the broker) when < 60 s remain; only `exp`, `isDevAdmin`, `isCoreDev` are read by the page — the person-id claim, algorithm, issuer and audience are the backend's | `OptaqodeIdentity`: verifies the token (HS256 secret or JWKS for RS256/ES256; `exp`, `nbf`, optional `iss`/`aud`), takes the id from `sub` / `person_id` / `user_id`; `source: "orbit"` |
| The customer summary (§6.1) | `OrbitRecordsPort.customerSummary` | `GET /profiles/me` (customer's own token) → `UserProfile` (§2); for staff-side lookups by id: `GET /admin/rastreio/{userId}` → `{ person, wallets[], deposits[], withdrawals[], operations[], bonuses[], affiliation }` — the broker's own support console ("Rastreio", badge "Suporte") | `OptaqodeRecords.customerSummary`: `person` mapped (status, KYC, language, country, masked e-mail/phone, environment from the wallets) |
| The customer's records (§6.1 subjects) | `listRecords`, `getRecord` | Deposits (`GET /deposits`, `/deposits/:id`), withdrawals (`GET /withdrawals/history`), operations (`GET /operations`), all with the customer's token; the same lists inside `/admin/rastreio/{userId}` | `OptaqodeRecords.listRecords/getRecord` from the 360: `pix_deposit`, `withdrawal`, `operation` with readable statuses and masked facts; the reference is the broker's opaque id (§3) |
| The verified e-mail for notifications | `contactEmail` | `person.email` + `email_verified` | `toContactEmail`: only a verified address; otherwise "no address" |
| Who the staff are | `StaffDirectory` | `GET /admin/team-members` (roles `super_admin`, `regional_admin`, `admin`, `finance_manager`, `product_manager`, `auditor`; statuses `active`, `paused`, `suspended`, `pending`) | `OptaqodeStaffDirectory`: active members, roles mapped provisionally (§5), cached |
| Staff identity | `OrbitIdentityPort` | Back-office tokens in `optaqode.admin.token`; no staff `/me` is read by the frontend | `OptaqodeIdentity` with `x-orbit-actor: staff`: the directory decides the role, never the token's `isDevAdmin`/`isCoreDev` |
| Outbound e-mail | `EmailNotifierPort` | The broker sends its own e-mails (OTP, KYC); no endpoint a third party can use was found | Not integrated: the e-mail provider stays the Owner's decision (DEC-0039); the simulated outbox remains |
| In-product notifications on the broker | `NotificationsService` (ours) | The broker's notification center is UI with mock data (`notifications.mock.ts`); no API | Not integrated: our bell stays inside the support panel; feeding the broker's center needs a backend it does not have (Q10) |
| Where the panel lives | web shell (FEAT-CHAT) | No support/help/FAQ route on the `app` platform; no third-party widget (Intercom, Zendesk, Crisp…); header right cluster (`Header.tsx`), sidebar sections, profile menu and the mobile bottom bar are the natural mounts; dark-only theme in `globals.css` tokens; an iframe precedent (`DepositCheckoutEmbed.tsx`) with a sandbox and a 4.5 s fallback | Designed in §6; implemented in PH-13.2 |

## 2. Identity and session — contracts observed
- Token shape accepted by the page (the broker's src/types/auth.ts): `{ accessToken, refreshToken, expiresIn?, accountRestricted?, affiliateStatus?, affiliateAdditionalInfoStatus?, passwordSetupStatus? }` (snake_case also accepted). 2FA challenge: `{ challengeRequired: true, challengeId, challengeScope, challengeMethod, loginTicket, expiresInSeconds, attemptsLeft, deliveryHint? }`.
- Session ends on any 401/403 or `error_code === "AUTH_SESSION_INVALID"` (`session-policy.ts`); there is no idle timer — the lifetime is the JWT's `exp` (cookies up to 7 days). Our panel keeps its own idle sign-out (DEC-0030) on top.
- Headers the page sends on every API call (`browser-client.ts`): `Authorization: Bearer`, `x-company-id` (only when a company cookie exists — never written today), `x-language-code` and `Accept-Language` (`pt-BR` / `en-US` / `es-ES`), `x-forwarded-host`, `x-forwarded-proto`. Our client mirrors the first and the locale pair.
- `UserProfile` as normalized by the page (the broker's src/types/profile.ts), wire shape snake_case: `id`, `user_code`, `tenant_id`, `email`, `email_verified`, `phone_normalized`/`phone`, `phone_verified`, `country`/`country_code`, `first_name`, `last_name`, `full_name`, `username`, `avatar_key`, `date_of_birth`, `cpf`, `document_type`, `document_number`, `identity_policy`, `language`, `timezone`, `status`, `kyc_status_cache`/`kyc_status`, `vip_level`, `created_at`, `security { level, email_verified, phone_verified, two_factor_enabled, identity_verified, identity_status }`. Defaults the page applies when absent: `status = "unknown"`, `kycStatus = "none"`, `vipLevel = "beginner"` — the vocabularies are not fixed in the frontend (Q6).
- Ids: `id` is opaque (`PRF_…` in the admin search hints); `userCode` is the human number shown as `#104233`; wallets and operations carry `person_id`. Orbit Support keys cases on the id claim of the token (Q4 decides which claim).
- Cookies are host-only (`path=/`, no `Domain`): a panel on another subdomain cannot read `optaqode.app.token` (§6).

## 3. Records — contracts observed
Amounts are decimal strings; timestamps ISO-8601; the platform quote currency is `USDT`; fiat conversion travels in `paymentConversion` / `brlEquivalentAmount` / `quoteRate`.
| Subject | Endpoints (customer token) | Wire fields used by our mapper | Statuses | Our record |
|---|---|---|---|---|
| Deposit (`AppPixDeposit`) | `GET /deposits`, `GET /deposits/:id`, `POST /deposits` (never called by us) | `id, status, amount, currency, receive_amount, quote_currency, method, provider, created_at` | `initiated, pending, confirmed, expired, failed, rejected` (+ `paid` in the activity feed) | `pix_deposit` "Depósito PIX", status in pt-BR, facts: método, creditado, provedor, identificador |
| Withdrawal (`AppPixWithdrawal`) | `GET /withdrawals/history`, `GET /withdrawals/config` | `id, status, requested_amount, requested_currency, fee_amount, final_amount, receive_currency, created_at` | `processing, approved, rejected` (+ `paid`) | `withdrawal` "Saque", facts: taxa, valor líquido, identificador |
| Operation (`TradingOperationDto`) | `GET /operations` (cursor or offset pagination) | `id, asset, status, direction, stake, result, profit_amount, currency, open_price, close_price, opened_at, expires_at, settled_at, wallet_id` | `OPEN, SETTLED_WIN, SETTLED_LOSS, SETTLED_DRAW, CANCELLED, EXPIRED`; direction `CALL`/`PUT` | `operation` "Operação EURUSD", facts: direção, preços, resultado, expiração, identificador |
| Wallets (`TradingWalletDto`) | `GET /wallets/me` | `wallet_type (REAL/DEMO), currency, status, balances…` | — | only `environment` (real when any real wallet exists) — balances are not a support subject (§6.1) |
| Bonuses (`AppActiveBonus`) | `GET /bonuses/active` | — | `active, pending_expiration, completed, cancelled, expired` | not mapped (PH-4.3 `not_integrated` stays) |
References: the ids are opaque (`dep_…`, `wd_…`, `op_…` are the fixture's guess — Q7); the only human reference found is the withdrawal certificate code `NNN-WD-NNNNN` (`/certificate-verification`). Our records show the tail of the id as "Identificador" until the backend names a protocol number.

## 4. Contact and notifications
- E-mail/phone with verification flags on the profile; change/verify flows under `POST /profiles/me/email/*` and `/phone/*`; OTP under `/kyc/email/*`, `/kyc/phone/*`. Orbit Support only reads (verified address → notifier).
- No notification preferences API; the broker's notification center is mock UI; realtime is WebSocket (`wss://<host>/api/v1/{wallets/me/ws, operations/ws, trading/reactions/ws, ws/partner-chat}`, auth by `?token=`) and SSE for market data with a ticket (`POST /market-data/stream-ticket`). Our SSE streams stay ours.
- Prior art inside the broker: the partner chat (`PartnerChatPanel.tsx`, `PartnerMessage { id, thread_id, sender_role, body, email_status…, receipts[] }`, magic-link access `POST /admin/auth/chat-access`) — a messaging backbone Orbit Support does not depend on but could later feed (Q13/Q14).

## 5. Staff — contracts observed and the provisional role map
- `GET /admin/team-members` rows: `{ id, name, email, avatarKey, role, permissions[], marketCountryCode, status, lastAccessAt, … }`; permissions such as `users.view`, `withdrawals.approve`; markets `BR`, `MX`, `CO`.
- Role map (`STAFF_ROLE_MAP`, DEC-0045 c — provisional until the Owner names who supervises support): `super_admin`, `admin` → `admin`; `regional_admin`, `finance_manager` → `supervisor`; `product_manager`, `auditor` → `agent`. Only `status: active` members exist for transfers.

## 6. Embedding the panel in the broker (design for PH-13.2)
- Route: the broker's middleware 404s any path not in `PLATFORM_CONFIG.app.routePaths`: a `/suporte` entry (and a `publicRoutes` entry for the recovery form) must be added there; mounts: the header's right cluster (`Header.tsx`, next to `NotificationsButton`), the sidebar `SIDEBAR_SECTIONS`, the profile menu `menuItems`, and the mobile bottom bar (five fixed tabs today).
- Session hand-off: same-origin is the only way the page can read `optaqode.app.token`; the panel therefore either (a) ships inside the broker's app as a component that calls our API with `Authorization: Bearer <that token>` through a rewrite (`/support-api/:path* → <our API>`), or (b) lives on its own host and receives the token by a short-lived hand-off the backend mints (Q2/Q14). (a) is the recommendation: no new cookie domain, the broker's refresh keeps working, and our identity provider needs nothing but the token.
- Our web today sends simulated identity headers (`customerIdentityHeaders`); PH-13.2 adds a bearer identity source (the token read by the host, refreshed by the host) and keeps the labeled pickers for the demo.
- Theme: the broker is dark-only (`--theme-background #000000`, cards `#0D0D0D`, primary `#0f5efc`, text `#f4f7ff` / `#838a97`, fonts Inter and DM Sans, z-index `--layer-modal: 120`); our panel maps its tokens onto these in PH-13.2.
- The broker's anti-inspection guard (`inspection-protection.ts`, active outside `ENVIRONMENT=development`) redirects to `/inspection-blocked` when the viewport gap suggests docked DevTools — a docked side panel can trip it (Q20); no CSP/`frame-ancestors` is defined in the repository (set at the edge).
- Languages: the broker ships pt-BR, en-US and es-ES together; our copy is pt-BR (es later — context §10.1).

## 7. Open questions for the broker's backend (blocking the live connection — BL-032)
1. Token verification material for a third party: HS256 secret, JWKS URL, introspection endpoint, or a service-to-service exchange? Algorithm, issuer, audience.
2. The person-id claim of the access token (`sub`?), and the canonical customer id to key on (`id` / `person_id` / `PRF_…` / `user_code`).
3. A service credential for Orbit Support to read `/admin/rastreio/{userId}` and `/admin/team-members` (scope, rotation, rate limits, audit trail).
4. Whether `x-company-id`/`tenant_id` matters for a single-tenant deployment.
5. The authoritative enumerations of `status`, `kyc_status`, `vip_level`, wallet `status`, `provider`/`method` ids.
6. Human-readable protocol numbers for deposits, withdrawals and operations (what a customer reads to an agent).
7. Logout/revocation semantics (`POST /api/auth/logout` only clears cookies) and refresh-token rotation (does a refresh from our panel race the broker's?).
8. A notification backend (list, mark read, count) if the broker's center is to show support updates; contact preferences and consent (LGPD).
9. Whether the partner-chat backbone and the magic-link session (`POST /admin/auth/chat-access`) are reusable for support.
10. A staff `/me` (role, permissions, market) and the canonical permission strings.
11. Edge policy: CSP `frame-ancestors`, CORS for our API host, and an exemption for the anti-inspection guard.
12. Data residency for what Orbit Support stores (cases quote no document numbers today; keep it so).

## 8. Where the preparation lives
`apps/api/src/identity/optaqode/` — `optaqode-config.ts` (env, `ORBIT_*`), `optaqode-client.ts` (GET-only client, error shape, timeout), `optaqode-jwt.ts` (HS256/JWKS verification without a library), `optaqode-mappers.ts` (wire types transcribed from the frontend + pure mappers), `optaqode-identity.ts`, `optaqode-records.ts`, `optaqode-staff-directory.ts`, `optaqode.spec.ts` (fixtures, no network). Selection in `apps/api/src/identity/identity.module.ts` (`SUPPORT_IDENTITY_PROVIDER`, `SUPPORT_ORBIT_RECORDS`, `SUPPORT_STAFF_DIRECTORY` = `simulated` | `optaqode`); `/api/health` names all three. Variables in `.env.example`. Runbook: `../runbooks/DEPLOYMENT.md` "Orbit adapters".
