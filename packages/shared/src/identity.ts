/**
 * Identity vocabulary shared by API and web. Orbit itself does not exist yet (DEC-0003): every actor
 * resolved today comes from the simulated identity provider behind the Orbit boundary (ADR-0002).
 */
export const STAFF_ROLES = ["agent", "supervisor", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const IDENTITY_SOURCES = ["simulated", "orbit"] as const;
export type IdentitySource = (typeof IDENTITY_SOURCES)[number];

/** Request headers understood by the simulated identity provider. Never valid for a real Orbit session. */
export const SIMULATED_IDENTITY_HEADERS = {
  customerId: "x-simulated-customer-id",
  staffId: "x-simulated-staff-id",
  staffRole: "x-simulated-staff-role",
  staffName: "x-simulated-staff-name",
} as const;

/** A member of the SIMULATED staff directory (DEC-0003). Replaced by Orbit's directory when it exists. */
export interface SimulatedStaffMember {
  id: string;
  name: string;
  role: StaffRole;
}

/**
 * The only staff members that exist until Orbit provides a directory. The web offers them as identities and
 * transfer targets; the API refuses transfers to anyone else so a case can never leave every queue and every
 * agent's list (RULE-SUP-02 — Cycle Audit 1, FND-0007).
 */
export const SIMULATED_STAFF_DIRECTORY: readonly SimulatedStaffMember[] = [
  { id: "staff-ana", name: "Ana Ribeiro", role: "agent" },
  { id: "staff-bruno", name: "Bruno Costa", role: "agent" },
  { id: "staff-carla", name: "Carla Nunes", role: "supervisor" },
  /** An administrator (PH-10.3): exports of a customer's data are theirs alone (DEC-0039 h). */
  { id: "staff-dani", name: "Dani Alves", role: "admin" },
];

export const isSimulatedStaffId = (id: string): boolean => SIMULATED_STAFF_DIRECTORY.some((member) => member.id === id);

export const findSimulatedStaff = (id: string): SimulatedStaffMember | undefined => SIMULATED_STAFF_DIRECTORY.find((member) => member.id === id);

/**
 * Role model (PH-7.2, DEC-0029; context §5.1, RULE-SUP-02/-09). One table for API and web:
 * - any staff member may reply, write internal notes, answer a consultation (the specialist is rarely the owner)
 *   and take an unowned case — replying to an unowned case makes the replier responsible (RULE-SUP-02);
 * - changing status, resolving, closing, asking a consultation, editing attributes, transferring/releasing and
 *   linking an incident on a case someone ELSE owns needs the owner or a supervisor/admin (DEC-0012 extended);
 * - supervisors/admins may do everything on every case (someone became unavailable — §5.2).
 */
export const STAFF_ACTIONS = [
  "reply",
  "internal_note",
  "take",
  "answer_consultation",
  "set_status",
  "resolve",
  "close",
  "consult",
  "edit_attributes",
  "transfer",
  "link_incident",
] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

/** How the acting staff member relates to the case's responsible agent. */
export type CaseOwnership = "own" | "unowned" | "other";
export const OPEN_TO_ANY_STAFF: readonly StaffAction[] = ["reply", "internal_note", "answer_consultation"];

export function caseOwnership(assignedAgentId: string | null, staffId: string): CaseOwnership {
  if (assignedAgentId === null) return "unowned";
  return assignedAgentId === staffId ? "own" : "other";
}

export function staffMay(role: StaffRole, action: StaffAction, ownership: CaseOwnership): boolean {
  // Taking claims an UNOWNED case, for every role; moving a colleague's case is "transfer" (Cycle Audit 3).
  if (action === "take") return ownership !== "other";
  if (role !== "agent") return true;
  if (OPEN_TO_ANY_STAFF.includes(action)) return true;
  return ownership !== "other";
}

/**
 * Formal complaints are a supervisor's duty (DEC-0039 g, PH-10.2): an agent may neither take nor work one — no
 * reply, note, state change, consultation or transfer — whatever the ownership. Answering a consultation stays
 * open to the specialist asked. One rule for the API and the web.
 */
export function staffMayWorkComplaint(role: StaffRole): boolean {
  return role !== "agent";
}
