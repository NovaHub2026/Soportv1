import type { Metadata } from "next";
import { StaffWorkspace } from "@/features/staff/StaffWorkspace";
import { dictionary } from "@/i18n";

export const metadata: Metadata = { title: dictionary.staff.title };

/** Orbit's administrative support area (PROJECT_CONTEXT.md §5). Staff identity is simulated (DEC-0003). */
export default function StaffPage() {
  return <StaffWorkspace />;
}
