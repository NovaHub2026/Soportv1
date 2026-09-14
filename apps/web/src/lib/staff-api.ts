import {
  type CaseMessage,
  type CaseSummary,
  type PostMessageInput,
  SIMULATED_IDENTITY_HEADERS,
  type StaffCaseDetail,
  type StaffQueueView,
  type StaffRole,
} from "@orbit-support/shared";
import { apiRequest } from "./api";

/** The staff member the browser acts as. Simulated until Orbit staff accounts exist (DEC-0003). */
export interface StaffIdentity {
  staffId: string;
  displayName: string;
  role: StaffRole;
}

const staffHeaders = (identity: StaffIdentity) => ({
  [SIMULATED_IDENTITY_HEADERS.staffId]: identity.staffId,
  [SIMULATED_IDENTITY_HEADERS.staffName]: identity.displayName,
  [SIMULATED_IDENTITY_HEADERS.staffRole]: identity.role,
});

export const staffApi = {
  listCases: (identity: StaffIdentity, view: StaffQueueView, signal?: AbortSignal) =>
    apiRequest<CaseSummary[]>(`/staff/cases?view=${view}`, staffHeaders(identity), { signal }),
  getCase: (identity: StaffIdentity, caseId: string, signal?: AbortSignal) =>
    apiRequest<StaffCaseDetail>(`/staff/cases/${caseId}`, staffHeaders(identity), { signal }),
  takeCase: (identity: StaffIdentity, caseId: string) =>
    apiRequest<CaseSummary>(`/staff/cases/${caseId}/take`, staffHeaders(identity), { method: "POST" }),
  postMessage: (identity: StaffIdentity, caseId: string, input: PostMessageInput) =>
    apiRequest<CaseMessage>(`/staff/cases/${caseId}/messages`, staffHeaders(identity), { method: "POST", body: input }),
};
