# PROJECT CONTEXT — Orbit Support

Type: PROJECT CONTEXT  
Version: 1.0  
Status: INITIAL PRODUCT BASELINE  
Prepared: 2026-09-13  
Product owner: Orbit's Human Owner  
Development governance: `GOVERNANCE.md`  
Document language: English; initial customer experience: Brazilian Portuguese.

## 1. Project definition

Orbit Support is the customer-service capability for Orbit, a trading platform. It gives customers an accessible way to speak with the support team and gives that team a complete workspace to investigate, respond to and follow through on each issue.

The initial experience is a human-operated chat inside Orbit. Behind each support matter is a persistent case, with its own reference number, conversation, responsible team or agent, status, history and related Orbit records. The customer should experience a straightforward conversation; staff should have enough context and organization to resolve the issue without repeatedly asking for information Orbit already holds.

The same customer entrypoint will later become a help center with articles and automated answers. Human assistance, existing conversations and case history must remain part of that experience.

This is the project's initial product context. It describes the destination, intended behavior, scope and constraints. Claude Code determines architecture, implementation details, technical phases and verification plans under `GOVERNANCE.md`, after establishing the actual repository state. This document does not claim that the support system or any specific integration already exists.

### 1.1 Basis and decision status

The Owner explicitly requested:

- Human chat support as the initial customer channel.
- A staff interface for answering and managing tickets, including closing and resuming cases.
- Connection to Orbit users and relevant trading-platform information, especially user identity and IDs.
- Evolution of the same chat into a help center with automated responses.
- Frontend using React, Next.js and TypeScript; backend/application using NestJS and TypeScript.
- A project context rather than a technical implementation guide, with autonomous development governed separately.

The behavior below consolidates those requirements and the working support concept developed for Orbit. Reversible defaults are identified in section 13; operational unknowns are identified separately. Proposed defaults must not be represented as decisions the Owner expressly made. They allow development to proceed without requiring the Owner to choose every detail.

## 2. Why this project exists

A trading-platform support interaction often concerns a particular account, payment, operation or promotion. A standalone chat message such as “my withdrawal has not arrived” is insufficient unless the agent can reliably identify the user, find the withdrawal and understand what has happened.

Orbit needs continuity across conversations, agents and internal teams. An issue should not disappear when a customer closes the chat, an agent ends a shift or another department becomes involved. Customers need to know that their request was received, whether a response or action is pending, and how to continue if the first answer did not solve the problem.

| Objective | Desired outcome |
|---|---|
| OBJ-SUP-01 — Accessible human help | A customer can reach support from Orbit and explain a problem with little friction. |
| OBJ-SUP-02 — Contextual investigation | Staff can identify the right customer and inspect the relevant records without unnecessary repetition. |
| OBJ-SUP-03 — Accountable follow-through | Every active case remains in a managed queue or with an identifiable responsible person until it receives a supported conclusion. |
| OBJ-SUP-04 — Trustworthy communication | Customers receive accurate updates, with appropriate privacy and a clear route to continue unresolved matters. |
| OBJ-SUP-05 — Continuity into self-service | Help articles and automation can be introduced into the same experience while preserving case history and access to people. |

These objectives guide product and technical trade-offs. A visually complete chat that staff cannot manage, or an administrative list that lacks a usable customer experience, does not satisfy the project.

## 3. Orbit environment and users

### 3.1 Relevant product environment

The Orbit context previously established for this work includes an initial Brazilian audience, later expansion to Spanish-speaking Latin America, trading through event contracts, Pix deposits in BRL with conversion to USDT, USDT withdrawals on TRC20, real and bonus balances, identity verification and promotions.

Support must be able to understand both ordinary event operations and the Evento P2P mode when those capabilities are available. P2P inquiries may concern a specific order and round, including a distinction between the time an entry was accepted and the time the round actually started.

These are integration contexts, not instructions to rebuild the underlying trading or financial products. The authoritative rules and actual availability of each Orbit capability must be established from the relevant project evidence. This support context does not change payout, bonus, referral, KYC, payment or settlement rules.

### 3.2 People who use the system

| User | Primary need |
|---|---|
| Orbit customer | Explain an issue, share the relevant record, receive help and follow the outcome. |
| Customer unable to sign in | Reach an appropriate recovery channel without exposing account data before identity is established. |
| Support agent | Handle assigned conversations, investigate the permitted customer context and keep cases moving. |
| Support supervisor | Manage queues, assignments, priorities, coverage and service quality. |
| Internal specialist | Review matters that require Finance, Operations, Security, verification or product expertise. |
| Support administrator | Configure the support operation within the permissions assigned to that role. |

One person may perform several roles in a small team. Their responsibilities and access rights must still be clear. Configuring support must not automatically grant permission to move funds or change sensitive account information.

## 4. Customer experience

### 4.1 Entering support

Customers have a consistent “Suporte” entrypoint within Orbit. On desktop, a side panel is the working default; on mobile, a dedicated full-screen view can provide enough space to read and respond. The placement must respect the trading interface and avoid covering essential order controls.

The opening experience offers a prominent action to speak with support, active conversations, previous cases and an honest indication of service availability. The user should not need to understand internal departments or ticket-management terminology to ask for help.

Short topic choices may help route a request: deposits and withdrawals, operations, account and verification, bonuses and promotions, or another subject. They should not become a long mandatory form before the first message.

Opening the panel alone does not create an empty case. Sending the first request creates the support matter and gives the customer a visible reference and conversation to return to.

### 4.2 Asking about a particular record

The detail of an operation, deposit or withdrawal provides a contextual help action, such as “Preciso de ajuda”. When used, the conversation includes a recognizable card or reference to that specific record.

The customer can see which item is attached to the request and correct the selection. The agent receives the corresponding authorized context. A signed-in customer should not have to manually type their own ID or copy a transaction identifier that Orbit can already identify.

General questions remain possible without choosing a record. If the same item already has an active case, suggest continuing that conversation while allowing the customer to explain that a new issue is different.

### 4.3 Conversation and continuity

Each conversation presents its subject, reference, understandable status, messages, permitted attachments and related records. Customers can identify messages from support and system notices. The interface makes new/unread replies visible and distinguishes a message that could not be sent from one successfully received.

The history remains available after closing the panel, signing out or returning from another authenticated device. Temporary disconnection should not cause silent message loss or duplicate visible requests when the customer retries.

A customer may have several cases for different matters. One permanent undifferentiated thread for every issue would make ownership, resolution and later review unclear.

### 4.4 Outside service hours

If no agents are available, the customer can still submit a request and obtain a reference. The experience explains the actual service schedule or the next expected attention period. It must not display an agent as online or promise immediate service when that is not true.

Responses generate an in-product notification. A notification to the verified email address can bring the customer back when a reply remains unread, according to configured delivery and preferences. Such notices should direct the customer to the authenticated conversation without exposing private financial information.

The initial email role is notification rather than a separate support conversation channel. Customers must not be led to believe an email reply became a case message unless that channel is actually supported.

### 4.5 Access problems

Someone unable to sign in needs a visible “Não consigo acessar minha conta” route. This initially represents an unverified recovery contact, not an authenticated account conversation.

Knowing an email, account ID, CPF or case reference must not reveal that account's private records or previous conversations. Account recovery follows Orbit's authorized verification process. Support never asks the customer to disclose a password, 2FA code or recovery secret in chat.

## 5. Staff experience

### 5.1 A dedicated support workspace

Staff need a complete operational workspace presented as Orbit's administrative support area. It must be comfortable for sustained daily use, with clear ownership, readable conversation history and fast access to the relevant customer context.

The workspace has three primary areas:

| Area | Expected content |
|---|---|
| Case list and queues | Reference, customer, subject, category, priority, assigned team/agent, latest activity and pending attention. |
| Conversation | Customer-visible messages, attachments, linked record cards, system events and clearly distinguished internal notes. |
| Customer and case context | Stable identity, account summary, related records, previous cases and authorized links to further details. |

The exact page layout, component design and technical placement within or alongside Orbit's existing administration are implementation decisions. The required outcome is an integrated working experience with appropriate access, not a prescribed repository structure.

### 5.2 Daily work

Agents can take an unassigned case, reply, use a saved response, attach permitted files, add an internal note, link a relevant record, request information, consult another team, transfer ownership, set priority and resolve or resume a case.

Essential views include unassigned cases, the agent's own cases, all accessible active cases, waiting for the customer, waiting for an internal team, cases requiring follow-up, resolved cases and closed history. Filters and search support case reference, user ID, username, authorized email and related operation/payment references.

The system helps agents avoid answering over each other and makes the actual responsible person clear. A transfer preserves history, the age of the request and pending commitments. When someone becomes unavailable, their active cases remain in a supervised queue or are reassigned.

### 5.3 Public replies and internal collaboration

“Reply to customer” and “Internal note” are visibly different actions. Notes allow staff to investigate, explain decisions and ask colleagues for help without publishing internal discussion to the customer.

A case can be referred to Finance, Operations, Security or another relevant team while the support owner remains responsible for customer updates. The consultation needs a clear question, recipient team, follow-up responsibility and an indication of what is still pending.

The initial version needs this collaboration to work clearly; a complex internal project-management system is outside the initial scope.

### 5.4 Supervision and prioritization

Supervisors can review outstanding demand, redistribute work, examine overdue follow-up, adjust categories/priorities and inspect service outcomes within their permissions. Configuration covers the operating schedule, categories, saved responses and relevant support defaults.

Priority reflects impact and urgency. Suspected unauthorized account activity or a widespread issue affecting customer funds deserves immediate attention from the appropriate team. Routine informational questions can follow the normal queue. A customer's commercial tier must not displace an urgent security issue.

Several customer cases may refer to one shared incident. A simple association and coordinated updates are sufficient initially. Individual conversations remain separate, and an incident being resolved does not automatically mean every affected customer's issue is resolved.

## 6. Connected Orbit information

### 6.1 Identity and context

The stable Orbit user ID is the primary customer reference. Usernames and contact details are helpful for recognition but can change. The case reference identifies a support matter and is not an access credential.

The standard customer summary includes username, account status, language, relevant country, registration date, masked contact information and a summarized verification status. When applicable, staff must distinguish the correct account and real/demo environment.

Show the information useful for the current issue, with deeper detail available to authorized staff. The goal is not to expose the customer's entire financial history by default.

| Subject | Context staff should be able to inspect when relevant and authorized |
|---|---|
| Operation/result | Operation ID, asset, mode, direction, amount/currency, contracted payout, acceptance/start/expiry times, applicable reference prices, result and settlement status. |
| Evento P2P | Order and round references, accepted entry, actual round timing, agreed conditions, result and tie refund when applicable. Other participants' identities remain private. |
| Pix deposit | Deposit reference, amount paid in BRL, conversion applied to that deposit, USDT credited, provider/payment reference, current status and relevant history. |
| Withdrawal | Withdrawal reference, amount/currency, network, fee, status changes, relevant pending/rejection reason and transaction hash when available; destination masked by default. |
| Balances/movements | Real, bonus, reserved and available amounts according to Orbit's authoritative definitions, together with movements related to the issue. |
| Bonus/promotion | Applied promotion and accepted conditions, activation, relevant real/bonus allocation, rollover progress and cancellation/conversion reason where applicable. |
| Verification/access | Verification status, information requested through the authorized process and the next appropriate customer action. Sensitive documents remain in their protected workflow. |
| Referral/affiliate question | The customer's relevant eligibility or commission context when those modules are available and within the staff member's role. |
| Product error | Relevant screen, basic device/browser context, application version and a safe error reference where available. |

These describe the information needed to serve the customer, not a required database schema or permission to create missing domain records. Discover actual availability during implementation and distinguish missing integration from missing underlying evidence.

### 6.2 Trustworthy investigation

Staff must distinguish the current status from what occurred at the time of the customer's operation or payment. Relevant times and currencies must be unambiguous. For a contested operation, the team needs evidence of the conditions accepted and the result recorded at settlement.

A screenshot can help explain a concern, but must not become the sole basis for reconstructing a trading result. The interface must not invent a historical price from current data. If the required evidence is unavailable, make that limitation visible and route the matter for appropriate review.

If linked account information cannot be retrieved, the conversation remains usable and the missing context is shown as unavailable. Missing data must not be displayed as zero balance, successful payment or another assumed state.

### 6.3 Financial and account authority

The support workspace provides contextual investigation and coordination. Ordinary support agents cannot directly edit balances, alter operation results, approve withdrawals, change accepted bonus conditions or bypass verification.

If a correction or sensitive action is justified, it follows the authorized Orbit process in the responsible domain. The support case can request and track that review. An authorized adjustment must remain attributable and linked to its reason; it must not silently erase the original event.

## 7. Case lifecycle

“Chat” is the communication experience. “Case” or “ticket” is the managed support matter. Its status reflects the work still required, not whether the customer currently has the chat open.

| Status | Meaning | Customer-facing interpretation |
|---|---|---|
| New | The request was received and is awaiting assignment. | Received. |
| In progress | Staff are investigating or responding. | Support is working on the request. |
| Waiting for customer | A specific response is needed from the customer. | We need your reply. |
| Waiting for internal team | A specialist or provider action/review is pending. | The request is under review. |
| Resolved | A supported solution or conclusion was communicated and no promised action remains outstanding. | Resolved; further help is still available. |
| Closed | The follow-up window ended and the case is finalized. | History remains available; further help starts a linked follow-up. |

Labels are localized for the user. Priority, escalation and reopening history are separate attributes of the matter; they do not replace its actual work status.

### 7.1 Resolving a case

Resolution needs a meaningful reason and an understandable customer-facing explanation. Sending a reply alone does not resolve a case if an investigation, payment correction or promised action remains pending.

A supported conclusion can be unfavorable to the customer and still complete a review. It must remain explainable, and the customer can ask for further review. Closing a case must not become a way to suppress an unresolved concern.

### 7.2 Resuming a resolved case

A customer can select “Ainda preciso de ajuda” or send another message while the case is resolved. The same case resumes with its original reference and full history.

The initial simple rule is that any new customer message in a resolved case reactivates it, including a thank-you; an agent may resolve it again where appropriate. The initial system does not need automated language interpretation to decide whether to ignore a reply.

A reply while waiting for the customer returns the matter to active attention. A reply while waiting for an internal team alerts the support owner without removing the outstanding internal dependency. Automated notices do not reopen cases by themselves.

### 7.3 Closing and later follow-up

The proposed initial follow-up window is seven calendar days after the latest resolution without reopening. After that, the case becomes closed. This is a configurable working default, not a legal deadline or an expressly chosen Owner policy.

From a closed conversation, “Preciso de mais ajuda” opens a linked follow-up with a new reference. The customer and authorized staff can access the preceding context without retelling the whole issue. The interface explains the new reference and relationship.

Closing does not delete the case. History remains available subject to the adopted retention and privacy policy; closure does not imply indefinite retention.

### 7.4 Inactivity and delivery

Closing the chat, signing out, losing connection or not responding does not automatically resolve a case. Pending requests can receive reminders and staff review. An eventual inactivity policy must distinguish lack of response from an actual solution.

If a customer message arrives around the closing time, it must remain visible and actionable in either the resumed case or its linked follow-up. The customer must not lose the message or receive duplicate cases for the same submission.

## 8. Essential product rules

These identifiers support later traceability. The owning behavior is described in the referenced sections; technical plans must preserve it.

| Rule | Product requirement | Context |
|---|---|---|
| RULE-SUP-01 | A customer's private cases, records and files are available only to that customer and appropriately authorized staff. Knowing an ID is insufficient. | Sections 4.5, 6.1 and 10. |
| RULE-SUP-02 | Every active case remains in a managed queue or with a responsible agent; transfer and internal consultation preserve follow-through. | Section 5. |
| RULE-SUP-03 | Closing the interface or interrupting connectivity does not end the support matter or silently lose accepted communication. | Sections 4.3 and 7.4. |
| RULE-SUP-04 | Internal notes and restricted information are not published as customer replies, notifications or public-assistant context. | Sections 5.3 and 10. |
| RULE-SUP-05 | Resolving/closing a case does not itself change money, trading outcomes or account permissions. | Sections 6.3 and 7. |
| RULE-SUP-06 | Customers can continue unresolved matters with their earlier context preserved. | Sections 7.2 and 7.3. |
| RULE-SUP-07 | Answers and record displays distinguish verified facts, pending work and unavailable information. | Section 6.2. |
| RULE-SUP-08 | Service availability and promised response expectations reflect the actual operation. | Section 4.4. |
| RULE-SUP-09 | Material staff actions, responsibility changes and resolution history remain attributable; corrections are not silent rewrites. | Sections 5 and 10. |
| RULE-SUP-10 | Later self-service and automation preserve the customer's route to human help and the same case context. | Section 12. |

The configurable numbers in section 13 are not foundational invariants. They may be refined through the delegated decision process without treating every adjustment as a new product mandate.

## 9. Initial scope and non-goals

The initial release is a complete human-support service with both customer and staff experiences. Its implementation can be incremental, but production readiness must include a functioning path from customer request to staff attention and follow-up.

| Capability | Initial scope |
|---|---|
| Customer channel | Authenticated chat, contextual entry from relevant records, active cases and history. |
| Recovery access | An appropriate unverified contact route for customers unable to sign in. |
| Communication | Text, permitted image/PDF attachments, clear send/unread states and response notifications. |
| Case management | References, assignment, categories, priority, lifecycle, reopening and linked follow-up. |
| Staff workspace | Queues, conversation, customer context, search/filtering and saved replies. |
| Internal work | Private notes, specialist consultation, transfers and visible follow-up responsibility. |
| Orbit context | Customer/account identity and the operation, payment, bonus or verification information needed for supported inquiries. |
| Supervision | Basic queue oversight, service schedule/configuration and meaningful service metrics. |
| Access and accountability | Appropriate roles, restricted information, protected files and attributable actions. |
| Shared incidents | Simple case association and coordinated manual updates. |

Adjacent integrations, such as referral/affiliate details, follow the availability and launch scope of those Orbit modules. This does not authorize silently omitting the core identity, trading and payment context from the launched support experience.

Initial non-goals:

- An autonomous customer-answering AI, voice calls, WhatsApp, social-media support or a general omnichannel platform.
- A complete CRM, sales pipeline, campaign platform or internal project-management suite.
- Rebuilding Orbit's trading, wallet, KYC, bonus or payment systems.
- Giving general support agents direct financial administration powers.
- Investment advice, trade recommendations or automated decisions about disputed trading outcomes.
- A large public knowledge base or advanced workforce forecasting before the human-support operation works.
- A generic multi-company support SaaS product. This project serves Orbit; the separate governance remains reusable across projects.

No third-party support platform or AI provider has been selected by this context. Implementation choices must preserve the intended Orbit experience and the authorization boundaries in governance.

## 10. Product quality, language and privacy

### 10.1 Experience and tone

The support experience belongs visually to Orbit. Previously established brand cues are a dark appearance, primary blue `#0048FF`, accent orange `#FF7900` and Inter typography. Follow the current design system if the actual product has newer authoritative patterns.

Use Brazilian Portuguese for the initial customer interface and a structure that can later support Spanish. Staff language needs can be refined with the operating team. English project documents do not imply an English customer interface.

Copy should be clear, approachable and calm. Financial concerns and account problems call for precision and empathy. Use readable text, keyboard-accessible controls, recognizable statuses beyond color alone and layouts that work on desktop and mobile. Support messaging should help users understand the next step rather than expose implementation detail.

### 10.2 Privacy and accountability

Reveal customer information according to role and case need. Mask sensitive identifiers and contact/destination details by default. Identity documents remain in Orbit's protected verification process instead of becoming a parallel document archive in chat.

Attachments must be accessible only to the appropriate participants and must not expose unsafe content to them. If a file cannot be accepted or is still being checked, the user sees its actual state. Allowed types and size limits are working defaults in section 13.

Staff use individual accounts. Access revocation and stronger protection for staff/sensitive activity must follow Orbit's applicable security policies. Signing out on a shared device must not leave the previous customer's private chat visible to the next user.

Replies, ownership changes, internal consultations and resolutions need an attributable history. Correcting a sent reply should not silently rewrite what the customer previously saw. Exceptional sensitive-data removal follows the authorized privacy process and preserves appropriate accountability.

Retention, export permissions and formal-complaint handling are operational policies to establish before production. This context sets no legal retention period or regulatory response deadline.

## 11. Confirmed technical constraints and project boundaries

| Layer | Confirmed technology |
|---|---|
| Frontend | React, Next.js, TypeScript |
| Backend / application | NestJS, TypeScript |

These are the technology constraints supplied by the Owner. This context does not prescribe database technology, APIs, events, authentication implementation, real-time transport, file storage, deployment topology or repository layout.

The customer experience must integrate with Orbit and the staff workspace must receive trustworthy permitted context. Whether implementation lives in existing Orbit modules, a dedicated support project or another suitable arrangement is a technical decision to make from repository evidence and integration access. Functional integration is required; a particular service structure is not fixed here.

Repository contents, completed features and available integration interfaces have not been audited as part of creating this context. An unavailable Orbit integration can be simulated for development when clearly identified, but simulated records do not demonstrate a connected production capability.

## 12. Future direction

| Evolution | Product outcome |
|---|---|
| Help center | Customers can search published guidance and browse useful topics from the same support entrypoint while retaining conversations and human help. |
| Assistance for staff | Reviewed summaries and suggested replies reduce repetitive work while agents remain responsible for the customer-facing answer. |
| Automated customer answers | An identified assistant answers appropriate questions from approved content and authorized current account information, with human handoff when needed. |

Knowledge content must distinguish public guidance from internal procedures, and must have an owner, language and current applicability. A newly published promotion rule must not be presented as the rule accepted in an older transaction.

The future assistant must acknowledge missing information, avoid inventing transaction states and transfer a customer who requests a person. Disputes, suspected security issues and sensitive actions require the appropriate human review. A handoff preserves messages and linked records so the customer does not start again.

When a human takes over, the assistant must not continue sending competing replies. Outside service hours, human escalation becomes a visible queued request with accurate expectations. Automated support does not gain authority to move money, change results or bypass verification.

This direction should influence continuity and product choices now. It does not require implementing AI or a large knowledge platform in the initial release.

## 13. Working defaults, assumptions and open decisions

### 13.1 Reversible initial defaults

| Item | Working default | Decision treatment |
|---|---|---|
| Resolved-case follow-up window | Seven calendar days from the latest resolution before closure. | Configurable proposed default; not a legal deadline. |
| New customer message on a resolved case | Reactivate the same case regardless of message interpretation. | Simple initial behavior; any later filtering must preserve access to further help. |
| Contact after closure | New linked follow-up with access to the previous context. | Preserve a finalized record and easy continuation. |
| Attachments | PNG, JPEG, WebP and PDF; up to 10 MB each and three files per message. | Proposed limits to refine based on usability and operational capability. |
| Customer entry layout | Side panel on desktop; dedicated full-screen experience on mobile. | Design may adapt to Orbit's actual interface. |
| Initial email role | Notifications linking back to authenticated conversations. | Email-based case handling is later scope unless explicitly added. |
| Internal specialist work | Clear consultation and follow-up within the case. | Advanced subtasks are unnecessary initially. |

The Agent can refine reversible implementation and UX choices under governance, recording material decisions. Changes that undermine an explicit Owner objective, essential privacy boundary or ability to continue a case require the corresponding product decision rather than silent reinterpretation.

### 13.2 Decisions dependent on actual operations

| Unknown | Who supplies or establishes it | Why it matters |
|---|---|---|
| Staffing, working hours and coverage | Orbit's Owner/Operations. | Determines honest availability and response expectations. |
| Response/follow-up targets by urgency | Operations, informed by actual capacity. | Supports prioritization and escalation without invented promises. |
| Precise roles and specialist contacts | Operations and the appropriate security/domain owners. | Determines who may inspect data and act on a referral. |
| Existing Orbit integration capabilities | Development Agent through authorized repository and system inspection. | Determines the implementation path and any real integration blockers. |
| Account recovery procedure | Orbit's authorized account/security process. | Allows access help without exposing another person's account. |
| Retention, exports and formal complaints | Operations and the responsible legal/privacy function. | Determines production operating policy. |
| Notification infrastructure and any service commitments | Development Agent investigates; Owner decides commitments outside existing authorization. | Determines which notification channels can actually be delivered. |

These unknowns do not prevent producing the interfaces, core behavior or implementation plans. The Agent should resolve discoverable facts autonomously and isolate actual blockers. A public promise or sensitive action dependent on a missing policy must not be invented to complete a screen.

## 14. What a successful initial product looks like

The release should demonstrate the following product situations, with evidence prepared by the Development Agent under governance:

1. A signed-in customer opens help from a withdrawal; the agent receives the correct customer and withdrawal context without asking for IDs already known to Orbit.
2. A general question becomes an assigned case, receives a reply and remains available when the customer returns later.
3. An agent consults an internal specialist while the customer sees an accurate status and continues receiving updates from a responsible person.
4. An internal note, another customer's records and restricted attachments remain inaccessible to the customer viewing their own case.
5. A resolved matter is resumed with the same history; a closed matter produces an understandable linked follow-up.
6. Disconnection, retry or an agent transfer does not silently lose messages or accountability.
7. A missing payment/trading record is visibly unavailable and is investigated rather than replaced with an assumed answer.
8. A customer unable to sign in can request appropriate help without obtaining private account history before verification.
9. Staff can identify unassigned, waiting and overdue-follow-up cases and use that information to keep the queue moving.
10. The customer and staff interfaces work together; a demonstration is explicit about whether it uses actual Orbit integrations or development examples.

Useful success signals include time to first human response, age of unanswered cases, total time to resolution, time waiting on a customer/internal team, reopening rate, satisfaction and repeated requests for information Orbit already possesses. Automated acknowledgements must not inflate the human-response metric, and closing more cases alone does not prove better service.

Numeric service targets should be established from the actual operating model and evidence. The initial goal is an accessible, connected and accountable support service that the team can genuinely operate.

## 15. Relationship to development governance

Use this document and `GOVERNANCE.md` as the project's initial inputs. This context owns Orbit Support's intended product behavior; the governance owns how the Development Agent decides, works, verifies and preserves continuity.

Claude Code should establish the actual repository state, resolve discoverable unknowns, derive the architecture and organize meaningful phases/subphases autonomously. Preserve the confirmed stack and product objectives, and distinguish accepted intent from the implementation that exists at any given time.

Current implementation details, technical contracts, phase progress and verification evidence belong in the appropriate downstream records defined by governance. Update this context when the accepted product direction changes; do not turn it into a chronological development log or duplicate the universal governance inside it.
