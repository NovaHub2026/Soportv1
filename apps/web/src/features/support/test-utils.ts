import { vi } from "vitest";

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = (request: RecordedRequest) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;

/** Replaces global fetch with a recorder; `respond` decides what each request gets back. */
export function mockFetch(respond: Responder) {
  const requests: RecordedRequest[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const request: RecordedRequest = {
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);
    const { status = 200, body = null } = await respond(request);
    return new Response(body === null ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return { requests, spy };
}

export const identity = { customerId: "cust-test" };

export function summary(overrides: Partial<import("@orbit-support/shared").CaseSummary> = {}) {
  const now = new Date().toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference: "SUP-000001",
    customerId: identity.customerId,
    subject: "Meu saque não chegou",
    category: "deposits_withdrawals" as const,
    status: "new" as const,
    priority: "normal" as const,
    assignedAgentId: null,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    lastCustomerMessageAt: now,
    lastStaffMessageAt: null,
    customerLastReadAt: null,
    staffLastReadAt: null,
    unreadCount: 0,
    resolvedAt: null,
    resolutionReason: null,
    closedAt: null,
    parentCaseId: null,
    parentReference: null,
    incidentId: null,
    incidentTitle: null,
    recordKind: null,
    recordReference: null,
    awaitingReplySince: null,
    waitingInternalSince: null,
    ...overrides,
  };
}

export function message(overrides: Partial<import("@orbit-support/shared").CaseMessage> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    caseId: "11111111-1111-4111-8111-111111111111",
    authorType: "customer" as const,
    authorId: identity.customerId,
    authorName: null,
    visibility: "public" as const,
    body: "Meu saque não chegou",
    clientMessageId: null,
    createdAt: new Date().toISOString(),
    attachments: [],
    ...overrides,
  };
}

export function attachment(overrides: Partial<import("@orbit-support/shared").CaseAttachment> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    caseId: "11111111-1111-4111-8111-111111111111",
    messageId: "22222222-2222-4222-8222-222222222222",
    uploaderType: "customer" as const,
    uploaderId: identity.customerId,
    fileName: "comprovante.png",
    mimeType: "image/png",
    sizeBytes: 34_567,
    status: "available" as const,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
