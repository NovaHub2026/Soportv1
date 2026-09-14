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
];

export const isSimulatedStaffId = (id: string): boolean => SIMULATED_STAFF_DIRECTORY.some((member) => member.id === id);
