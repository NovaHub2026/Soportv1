import { describe, expect, test } from "vitest";
import { caseOwnership, findSimulatedStaff, STAFF_ACTIONS, staffMay, staffMayWorkComplaint } from "./identity.js";

describe("role model (PH-7.2, DEC-0029)", () => {
  test("agents act on their own or unowned cases; replies, notes and consultation answers are open to any staff", () => {
    for (const action of STAFF_ACTIONS) {
      expect(staffMay("agent", action, "own")).toBe(true);
      expect(staffMay("agent", action, "unowned")).toBe(true);
      if (action === "take") continue; // taking claims an unowned case for everyone; reassignment is "transfer"
      expect(staffMay("supervisor", action, "other")).toBe(true);
      expect(staffMay("admin", action, "other")).toBe(true);
    }
    expect(staffMay("supervisor", "take", "other")).toBe(false);
    for (const action of ["reply", "internal_note", "answer_consultation"] as const) expect(staffMay("agent", action, "other")).toBe(true);
    for (const action of ["set_status", "resolve", "close", "consult", "edit_attributes", "transfer", "link_incident", "take"] as const) expect(staffMay("agent", action, "other")).toBe(false);
  });

  test("ownership is derived from the responsible agent", () => {
    expect(caseOwnership(null, "staff-ana")).toBe("unowned");
    expect(caseOwnership("staff-ana", "staff-ana")).toBe("own");
    expect(caseOwnership("staff-bruno", "staff-ana")).toBe("other");
    expect(findSimulatedStaff("staff-carla")?.role).toBe("supervisor");
    expect(findSimulatedStaff("staff-zzz")).toBeUndefined();
  });

  test("formal complaints are worked by supervisors and admins only (DEC-0039 g)", () => {
    expect(staffMayWorkComplaint("agent")).toBe(false);
    expect(staffMayWorkComplaint("supervisor")).toBe(true);
    expect(staffMayWorkComplaint("admin")).toBe(true);
  });
});
