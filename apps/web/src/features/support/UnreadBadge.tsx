import { fill } from "@/i18n";
import styles from "./support.module.css";

interface UnreadBadgeProps {
  count: number;
  one: string;
  many: string;
}

/** Count of unread messages with an accessible name; renders nothing when there is nothing new. */
export function UnreadBadge({ count, one, many }: UnreadBadgeProps) {
  if (count <= 0) return null;
  const label = count === 1 ? one : fill(many, { n: String(count) });
  return (
    <span className={styles.unreadBadge} aria-label={label} title={label}>
      {count}
    </span>
  );
}
