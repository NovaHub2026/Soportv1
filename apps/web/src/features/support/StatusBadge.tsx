import type { CaseStatus } from "@orbit-support/shared";
import { dictionary as t } from "@/i18n";
import styles from "./support.module.css";

/** Status as text plus a tone; never color alone (context §10.1). */
export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {t.status[status]}
    </span>
  );
}
