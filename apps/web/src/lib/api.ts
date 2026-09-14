import {
  type CaseAttachment,
  type CaseMessage,
  type CreateCaseInput,
  type CustomerCaseDetail,
  type CustomerCaseSummary,
  type FollowUpInput,
  type OrbitLookup,
  type OrbitRecordListItem,
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
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
}

/** A stalled mutation must become a failure the UI can retry, never an eternal "Enviando…" (FND-0012). */
export const MUTATION_TIMEOUT_MS = 20_000;

function mutationSignal(options: RequestOptions): AbortSignal | undefined {
  if (options.signal || (options.method ?? "GET") === "GET") return options.signal;
  const abortSignal = globalThis.AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal };
  return typeof abortSignal?.timeout === "function" ? abortSignal.timeout(MUTATION_TIMEOUT_MS) : undefined;
}

/**
 * Whether retrying the same request could ever succeed. Validation, ownership and state conflicts (4xx) will
 * answer the same way again; network failures, timeouts and 5xx may not.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status < 400 || error.status >= 500 || error.status === 408 || error.status === 429;
}

/** The API's error code (`message` of Nest exceptions or `error` of structured bodies), if any. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError) || typeof error.body !== "object" || error.body === null) return null;
  const body = error.body as { message?: unknown; error?: unknown };
  if (typeof body.error === "string") return body.error;
  if (typeof body.message === "string") return body.message;
  return null;
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
    signal: mutationSignal(options),
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

/** Multipart upload of one file; the server decides the real type from the bytes. */
export async function uploadFile(path: string, identityHeaders: Record<string, string>, file: File): Promise<CaseAttachment> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`/api${path}`, { method: "POST", headers: { accept: "application/json", ...identityHeaders }, body: form });
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(response.status, data);
  return data as CaseAttachment;
}

/** Bytes of a protected attachment; identity travels in headers, so plain `<img src>` cannot be used. */
export async function fetchBlob(path: string, identityHeaders: Record<string, string>, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`/api${path}`, { headers: identityHeaders, cache: "no-store", signal });
  if (!response.ok) throw new ApiError(response.status, null);
  return response.blob();
}

/** What the attachment UI needs from either side (customer or staff). */
export interface AttachmentClient {
  upload: (file: File) => Promise<CaseAttachment>;
  fetchBlob: (attachmentId: string, signal?: AbortSignal) => Promise<Blob>;
}

export const customerApi = {
  /** The customer's own Orbit records for contextual entry (PH-4.2); each says whether an active case already exists. */
  listRecords: (identity: CustomerIdentity, signal?: AbortSignal) =>
    apiRequest<{ records: OrbitLookup<OrbitRecordListItem[]> }>("/support/records", customerHeaders(identity), { signal }),
  listCases: (identity: CustomerIdentity, signal?: AbortSignal) =>
    apiRequest<CustomerCaseSummary[]>("/support/cases", customerHeaders(identity), { signal }),
  getCase: (identity: CustomerIdentity, caseId: string, signal?: AbortSignal) =>
    apiRequest<CustomerCaseDetail>(`/support/cases/${caseId}`, customerHeaders(identity), { signal }),
  createCase: (identity: CustomerIdentity, input: CreateCaseInput) =>
    apiRequest<CustomerCaseDetail>("/support/cases", customerHeaders(identity), { method: "POST", body: input }),
  postMessage: (identity: CustomerIdentity, caseId: string, input: PostMessageInput) =>
    apiRequest<CaseMessage>(`/support/cases/${caseId}/messages`, customerHeaders(identity), { method: "POST", body: input }),
  markRead: (identity: CustomerIdentity, caseId: string) =>
    apiRequest<CustomerCaseSummary>(`/support/cases/${caseId}/read`, customerHeaders(identity), { method: "POST" }),
  followUp: (identity: CustomerIdentity, caseId: string, input: FollowUpInput) =>
    apiRequest<CustomerCaseDetail>(`/support/cases/${caseId}/follow-up`, customerHeaders(identity), { method: "POST", body: input }),
  attachments: (identity: CustomerIdentity, caseId: string): AttachmentClient => ({
    upload: (file) => uploadFile(`/support/cases/${caseId}/attachments`, customerHeaders(identity), file),
    fetchBlob: (attachmentId, signal) => fetchBlob(`/support/cases/${caseId}/attachments/${attachmentId}`, customerHeaders(identity), signal),
  }),
};

/** Stable per-attempt id so a retried send is stored once (RULE-SUP-03). */
export function newClientMessageId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && "randomUUID" in cryptoApi) return cryptoApi.randomUUID();
  return `cm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
