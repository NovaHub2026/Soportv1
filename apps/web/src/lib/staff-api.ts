import {
  type AnswerConsultationInput,
  type AssignCaseInput,
  type CaseConsultation,
  type CaseMessage,
  type CaseSummary,
  type PostMessageInput,
  type PostNoteInput,
  type RequestConsultationInput,
  type ResolveCaseInput,
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

export const staffApi = {
  listCases: (identity: StaffIdentity, view: StaffQueueView, signal?: AbortSignal) =>
    apiRequest<CaseSummary[]>(`/staff/cases?view=${view}`, staffHeaders(identity), { signal }),
  getCase: (identity: StaffIdentity, caseId: string, signal?: AbortSignal) =>
    apiRequest<StaffCaseDetail>(`/staff/cases/${caseId}`, staffHeaders(identity), { signal }),
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
  attachments: (identity: StaffIdentity, caseId: string): AttachmentClient => ({
    upload: (file) => uploadFile(`/staff/cases/${caseId}/attachments`, staffHeaders(identity), file),
    fetchBlob: (attachmentId, signal) => fetchBlob(`/staff/cases/${caseId}/attachments/${attachmentId}`, staffHeaders(identity), signal),
  }),
};
