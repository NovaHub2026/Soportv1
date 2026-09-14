import {
  type CaseMessage,
  type CaseSummary,
  type CreateCaseInput,
  type CustomerCaseDetail,
  type PostMessageInput,
  SIMULATED_IDENTITY_HEADERS,
} from "@orbit-support/shared";

/** Who the browser is acting as. Simulated until Orbit sessions exist (DEC-0003, ADR-0002). */
export interface CustomerIdentity {
  customerId: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

async function apiFetch<T>(path: string, identity: CustomerIdentity, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      [SIMULATED_IDENTITY_HEADERS.customerId]: identity.customerId,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: "no-store",
  });
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export const customerApi = {
  listCases: (identity: CustomerIdentity, signal?: AbortSignal) =>
    apiFetch<CaseSummary[]>("/support/cases", identity, { signal }),
  getCase: (identity: CustomerIdentity, caseId: string, signal?: AbortSignal) =>
    apiFetch<CustomerCaseDetail>(`/support/cases/${caseId}`, identity, { signal }),
  createCase: (identity: CustomerIdentity, input: CreateCaseInput) =>
    apiFetch<CustomerCaseDetail>("/support/cases", identity, { method: "POST", body: input }),
  postMessage: (identity: CustomerIdentity, caseId: string, input: PostMessageInput) =>
    apiFetch<CaseMessage>(`/support/cases/${caseId}/messages`, identity, { method: "POST", body: input }),
};

/** Stable per-attempt id so a retried send is stored once (RULE-SUP-03). */
export function newClientMessageId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && "randomUUID" in cryptoApi) return cryptoApi.randomUUID();
  return `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
