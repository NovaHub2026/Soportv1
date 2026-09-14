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
