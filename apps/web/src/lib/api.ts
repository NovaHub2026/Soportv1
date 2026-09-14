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

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

/** Same-origin call to `/api/*` (rewritten to the API server); identity travels in the given headers. */
export async function apiRequest<T>(path: string, identityHeaders: Record<string, string>, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...identityHeaders,
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

export const customerIdentityHeaders = (identity: CustomerIdentity): Record<string, string> => ({
  [SIMULATED_IDENTITY_HEADERS.customerId]: identity.customerId,
});
const customerHeaders = customerIdentityHeaders;

export const customerApi = {
  listCases: (identity: CustomerIdentity, signal?: AbortSignal) =>
    apiRequest<CaseSummary[]>("/support/cases", customerHeaders(identity), { signal }),
  getCase: (identity: CustomerIdentity, caseId: string, signal?: AbortSignal) =>
    apiRequest<CustomerCaseDetail>(`/support/cases/${caseId}`, customerHeaders(identity), { signal }),
  createCase: (identity: CustomerIdentity, input: CreateCaseInput) =>
    apiRequest<CustomerCaseDetail>("/support/cases", customerHeaders(identity), { method: "POST", body: input }),
  postMessage: (identity: CustomerIdentity, caseId: string, input: PostMessageInput) =>
    apiRequest<CaseMessage>(`/support/cases/${caseId}/messages`, customerHeaders(identity), { method: "POST", body: input }),
};

/** Stable per-attempt id so a retried send is stored once (RULE-SUP-03). */
export function newClientMessageId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && "randomUUID" in cryptoApi) return cryptoApi.randomUUID();
  return `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
