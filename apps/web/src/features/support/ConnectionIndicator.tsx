import type { StreamStatus } from "@/lib/sse";
import styles from "./support.module.css";

interface ConnectionIndicatorProps {
  status: StreamStatus;
  labels: Record<StreamStatus, string>;
}

/** Honest connection state as text + tone (never color alone): "Ao vivo", "Reconectando…", "Sem conexão". */
export function ConnectionIndicator({ status, labels }: ConnectionIndicatorProps) {
  return (
    <span className={styles.connection} data-state={status} role="status" aria-live="polite">
      <span className={styles.connectionDot} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
