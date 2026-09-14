import { OPEN_CASE_STATUSES, type CaseStatus } from "@orbit-support/shared";
import { dictionary as t, fill, formatDuration, formatMessageTime, isPast } from "@/i18n";

/**
 * The deadline line of a formal complaint (DEC-0039 g), the same in the queue, the case and supervision: overdue only
 * while the case is still open — a resolved or closed complaint is not late (closing audit FND-0113).
 */
export function complaintDeadlineLine(status: CaseStatus, deadlineAt: string | null): { text: string; attention: boolean } | null {
  if (!deadlineAt) return null;
  const when = formatMessageTime(deadlineAt);
  if (!OPEN_CASE_STATUSES.includes(status)) return { text: fill(t.staff.complaint.deadlinePast, { when }), attention: false };
  if (isPast(deadlineAt)) return { text: fill(t.staff.complaint.overdue, { age: formatDuration(deadlineAt) }), attention: true };
  return { text: fill(t.staff.complaint.deadline, { when }), attention: false };
}
