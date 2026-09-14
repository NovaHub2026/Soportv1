import type { CaseStatus } from "@orbit-support/shared";
import { dictionary as t } from "@/i18n";
import styles from "./support.module.css";

interface StatusBadgeProps {
  status: CaseStatus;
  /** Alternative label set (e.g. staff wording); defaults to the customer-facing labels. */
  labels?: Record<CaseStatus, string>;
}

/** Status as text plus a tone; never color alone (context §10.1). */
export function StatusBadge({ status, labels = t.status }: StatusBadgeProps) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {labels[status]}
    </span>
  );
}
