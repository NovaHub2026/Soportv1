import { Injectable } from '@nestjs/common';
import { findSimulatedStaff, isSimulatedStaffId, type StaffRole } from '@orbit-support/shared';

/**
 * Who exists on the staff side — part of the Orbit boundary (ADR-0002). Transfers are validated against it so
 * a case can never be handed to nobody (RULE-SUP-02, Cycle Audit 1 FND-0007). Until Orbit provides a directory
 * the only implementation is the simulated list shared with the web (DEC-0003).
 */
export interface StaffDirectory {
  isKnownStaff(id: string): Promise<boolean>;
  /** The role a member has in the directory (PH-10.2: a formal complaint may only be handed to a supervisor or admin). */
  roleOf(id: string): Promise<{ role: StaffRole } | undefined>;
}

export const STAFF_DIRECTORY = Symbol('STAFF_DIRECTORY');

@Injectable()
export class SimulatedStaffDirectory implements StaffDirectory {
  async isKnownStaff(id: string): Promise<boolean> {
    return isSimulatedStaffId(id);
  }

  async roleOf(id: string): Promise<{ role: StaffRole } | undefined> {
    const member = findSimulatedStaff(id);
    return member ? { role: member.role } : undefined;
  }
}
