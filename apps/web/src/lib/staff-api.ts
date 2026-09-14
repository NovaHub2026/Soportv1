import {
  type AnswerConsultationInput,
  type AssignCaseInput,
  type CaseConsultation,
  type CaseMessage,
  type CaseSummary,
  type CreateIncidentInput,
  type Incident,
  type IncidentNoteInput,
  type IncidentStatus,
  type OrbitCaseContext,
  type PostMessageInput,
  type PostNoteInput,
  type RequestConsultationInput,
  type ResolveCaseInput,
  type SavedReply,
  type SavedReplyInput,
  type ServiceMetrics,
  type SupervisionOverview,
  type SupportSettings,
  type SupportSettingsInput,
  SIMULATED_IDENTITY_HEADERS,
  type StaffCaseDetail,
  type StaffQueueView,
  type StaffRole,
  type StaffStatusTarget,
  type UpdateCaseInput,
} from "@orbit-support/shared";
import { apiRequest, type AttachmentClient, fetchBlob, uploadFile } from "./api";

/** The staff member the browser acts as. Simulated until Orbit staff accounts exist (DEC-0003). */
export interface StaffIdentity {
  staffId: string;
  displayName: string;
  role: StaffRole;
}

export const staffIdentityHeaders = (identity: StaffIdentity): Record<string, string> => ({
  [SIMULATED_IDENTITY_HEADERS.staffId]: identity.staffId,
  [SIMULATED_IDENTITY_HEADERS.staffName]: identity.displayName,
  [SIMULATED_IDENTITY_HEADERS.staffRole]: identity.role,
});
const staffHeaders = staffIdentityHeaders;

/** Search and filters of the queue (PH-5.2); empty values are omitted from the request. */
export interface QueueFilters {
  q?: string;
  category?: string;
  priority?: string;
  agentId?: string;
}

export function queueFilterQuery(filters?: QueueFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value.trim()) params.set(key, value.trim());
  const encoded = params.toString();
  return encoded ? `&${encoded}` : "";
}

export const staffApi = {
  listCases: (identity: StaffIdentity, view: StaffQueueView, signal?: AbortSignal, page?: { limit: number; offset: number }, filters?: QueueFilters) =>
    apiRequest<CaseSummary[]>(
      `/staff/cases?view=${view}${page ? `&limit=${page.limit}&offset=${page.offset}` : ""}${queueFilterQuery(filters)}`,
      staffHeaders(identity),
      { signal },
    ),
  getCase: (identity: StaffIdentity, caseId: string, signal?: AbortSignal) =>
    apiRequest<StaffCaseDetail>(`/staff/cases/${caseId}`, staffHeaders(identity), { signal }),
  /** Orbit context of the case's customer (PH-4.1): available or explicitly unavailable, masked, labeled. */
  getOrbitContext: (identity: StaffIdentity, caseId: string, signal?: AbortSignal) =>
    apiRequest<OrbitCaseContext>(`/staff/cases/${caseId}/orbit`, staffHeaders(identity), { signal }),
  takeCase: (identity: StaffIdentity, caseId: string) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/take`, staffHeaders(identity), { method: "POST" }),
  postMessage: (identity: StaffIdentity, caseId: string, input: PostMessageInput) =>
    apiRequest<CaseMessage>(`/staff/cases/${caseId}/messages`, staffHeaders(identity), { method: "POST", body: input }),
  markRead: (identity: StaffIdentity, caseId: string) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/read`, staffHeaders(identity), { method: "POST" }),
  setStatus: (identity: StaffIdentity, caseId: string, status: StaffStatusTarget) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/status`, staffHeaders(identity), { method: "POST", body: { status } }),
  resolve: (identity: StaffIdentity, caseId: string, input: ResolveCaseInput) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/resolve`, staffHeaders(identity), { method: "POST", body: input }),
  listIncidents: (identity: StaffIdentity, status?: IncidentStatus, signal?: AbortSignal) =>
    apiRequest<Incident[]>(`/staff/incidents${status ? `?status=${status}` : ""}`, staffHeaders(identity), { signal }),
  createIncident: (identity: StaffIdentity, input: CreateIncidentInput) =>
    apiRequest<Incident>("/staff/incidents", staffHeaders(identity), { method: "POST", body: input }),
  linkIncident: (identity: StaffIdentity, caseId: string, incidentId: string | null) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/incident`, staffHeaders(identity), { method: "POST", body: { incidentId } }),
  resolveIncident: (identity: StaffIdentity, incidentId: string) =>
    apiRequest<Incident>(`/staff/incidents/${incidentId}/resolve`, staffHeaders(identity), { method: "POST" }),
  broadcastIncidentNote: (identity: StaffIdentity, incidentId: string, input: IncidentNoteInput) =>
    apiRequest<{ delivered: number }>(`/staff/incidents/${incidentId}/notes`, staffHeaders(identity), { method: "POST", body: input }),
  close: (identity: StaffIdentity, caseId: string) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/close`, staffHeaders(identity), { method: "POST" }),
  assign: (identity: StaffIdentity, caseId: string, input: AssignCaseInput) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/assign`, staffHeaders(identity), { method: "POST", body: input }),
  update: (identity: StaffIdentity, caseId: string, input: UpdateCaseInput) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}`, staffHeaders(identity), { method: "PATCH", body: input }),
  postNote: (identity: StaffIdentity, caseId: string, input: PostNoteInput) =>
    apiRequest<CaseMessage>(`/staff/cases/${caseId}/notes`, staffHeaders(identity), { method: "POST", body: input }),
  requestConsultation: (identity: StaffIdentity, caseId: string, input: RequestConsultationInput) =>
    apiRequest<CaseConsultation>(`/staff/cases/${caseId}/consultations`, staffHeaders(identity), { method: "POST", body: input }),
  answerConsultation: (identity: StaffIdentity, caseId: string, consultationId: string, input: AnswerConsultationInput) =>
    apiRequest<CaseConsultation>(`/staff/cases/${caseId}/consultations/${consultationId}/answer`, staffHeaders(identity), {
      method: "POST",
      body: input,
    }),
  getSettings: (identity: StaffIdentity, signal?: AbortSignal) => apiRequest<SupportSettings>("/staff/settings", staffHeaders(identity), { signal }),
  updateSettings: (identity: StaffIdentity, input: SupportSettingsInput) => apiRequest<SupportSettings>("/staff/settings", staffHeaders(identity), { method: "PUT", body: input }),
  overview: (identity: StaffIdentity, signal?: AbortSignal) => apiRequest<SupervisionOverview>("/staff/overview", staffHeaders(identity), { signal }),
  metrics: (identity: StaffIdentity, days: number, signal?: AbortSignal) => apiRequest<ServiceMetrics>(`/staff/metrics?days=${days}`, staffHeaders(identity), { signal }),
  listSavedReplies: (identity: StaffIdentity, signal?: AbortSignal) => apiRequest<SavedReply[]>("/staff/saved-replies", staffHeaders(identity), { signal }),
  createSavedReply: (identity: StaffIdentity, input: SavedReplyInput) => apiRequest<SavedReply>("/staff/saved-replies", staffHeaders(identity), { method: "POST", body: input }),
  updateSavedReply: (identity: StaffIdentity, id: string, input: SavedReplyInput) =>
    apiRequest<SavedReply>(`/staff/saved-replies/${id}`, staffHeaders(identity), { method: "PATCH", body: input }),
  deleteSavedReply: (identity: StaffIdentity, id: string) => apiRequest<null>(`/staff/saved-replies/${id}`, staffHeaders(identity), { method: "DELETE" }),
  attachments: (identity: StaffIdentity, caseId: string): AttachmentClient => ({
    upload: (file) => uploadFile(`/staff/cases/${caseId}/attachments`, staffHeaders(identity), file),
    fetchBlob: (attachmentId, signal) => fetchBlob(`/staff/cases/${caseId}/attachments/${attachmentId}`, staffHeaders(identity), signal),
  }),
};
