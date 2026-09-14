"use client";

import { CASE_CATEGORIES, CASE_PRIORITIES, type CaseSummary, STAFF_LIST_LIMITS, STAFF_QUEUE_VIEWS, type StaffQueueView } from "@orbit-support/shared";
import { useEffect, useRef, useState } from "react";
import { SIMULATED_STAFF } from "@/lib/simulated-session";
import { StatusBadge } from "@/features/support/StatusBadge";
import { UnreadBadge } from "@/features/support/UnreadBadge";
import { dictionary as t, fill, formatDuration, formatMessageTime } from "@/i18n";
import { type QueueFilters, type StaffIdentity, staffApi } from "@/lib/staff-api";

/** Typing pauses before a search request goes out. */
export const SEARCH_DEBOUNCE_MS = 300;
import styles from "./staff.module.css";

/** Safety-net refresh while the staff stream is down (ADR-0004). */
export const QUEUE_REFRESH_INTERVAL_MS = 10_000;
/** Safety-net refresh while the staff stream is connected. */
export const QUEUE_CONNECTED_REFRESH_INTERVAL_MS = 60_000;

interface StaffQueueProps {
  identity: StaffIdentity;
  view: StaffQueueView;
  onViewChange: (view: StaffQueueView) => void;
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  /** Bumped by the workspace whenever the live stream or an action says something changed. */
  refreshToken: number;
  /** Whether the live stream is connected; only changes the safety-net cadence. */
  live?: boolean;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; cases: CaseSummary[]; more: boolean };

const PAGE = STAFF_LIST_LIMITS.default;

export function StaffQueue({ identity, view, onViewChange, selectedCaseId, onSelectCase, refreshToken, live = false }: StaffQueueProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // How many pages the user asked for on this view; a refresh re-reads all of them so nothing vanishes. Another view starts at one page.
  const [paging, setPaging] = useState<{ view: StaffQueueView; pages: number }>({ view, pages: 1 });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<QueueFilters>({});
  // The debounced search term is what actually reaches the API.
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);
  const active = { ...filters, q };
  const pages = paging.view === view ? paging.pages : 1;
  const loadMore = () => setPaging({ view, pages: pages + 1 });
  // Monotonic request counter: a poll that started before an action must not overwrite the refreshed list.
  const requestSeq = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const id = ++requestSeq.current;
      try {
        const cases = await staffApi.listCases(identity, view, controller.signal, { limit: PAGE * pages, offset: 0 }, active);
        if (id !== requestSeq.current) return;
        setState({ status: "ready", cases, more: cases.length >= PAGE * pages });
      } catch (error: unknown) {
        if (controller.signal.aborted || id !== requestSeq.current) return;
        console.warn("staff: could not load queue", error);
        setState((current) => (current.status === "ready" ? current : { status: "error" }));
      }
    };
    void load();
    const timer = setInterval(load, live ? QUEUE_CONNECTED_REFRESH_INTERVAL_MS : QUEUE_REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `active` is derived from q and filters below
  }, [identity, view, refreshToken, attempt, live, pages, q, filters]);

  return (
    <section className={styles.queue} aria-label={t.staff.queues[view]}>
      <form className={styles.filters} role="search" aria-label={t.staff.search.label} onSubmit={(event) => event.preventDefault()}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder={t.staff.search.placeholder}
          aria-label={t.staff.search.label}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className={styles.filterSelect} aria-label={t.staff.search.category} value={filters.category ?? ""} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
          <option value="">{t.staff.search.anyCategory}</option>
          {CASE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t.category[category]}
            </option>
          ))}
        </select>
        <select className={styles.filterSelect} aria-label={t.staff.search.priority} value={filters.priority ?? ""} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
          <option value="">{t.staff.search.anyPriority}</option>
          {CASE_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {t.staff.priority[priority]}
            </option>
          ))}
        </select>
        <select className={styles.filterSelect} aria-label={t.staff.search.agent} value={filters.agentId ?? ""} onChange={(event) => setFilters({ ...filters, agentId: event.target.value })}>
          <option value="">{t.staff.search.anyAgent}</option>
          <option value="unassigned">{t.staff.unassigned}</option>
          {SIMULATED_STAFF.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {(search || filters.category || filters.priority || filters.agentId) && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setSearch("");
              setFilters({});
            }}
          >
            {t.staff.search.clear}
          </button>
        )}
      </form>
      <div className={styles.tabs} role="tablist">
        {STAFF_QUEUE_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === view}
            className={styles.tab}
            data-active={v === view ? "true" : "false"}
            onClick={() => onViewChange(v)}
          >
            {t.staff.queues[v]}
          </button>
        ))}
      </div>

      {state.status === "loading" && (
        <p className={styles.muted} role="status">
          {t.staff.loading}
        </p>
      )}
      {state.status === "error" && (
        <div className={styles.errorBox} role="alert">
          <p>{t.staff.error}</p>
          <button type="button" className={styles.secondaryButton} onClick={() => setAttempt((n) => n + 1)}>
            {t.staff.retry}
          </button>
        </div>
      )}
      {state.status === "ready" && state.cases.length === 0 && <p className={styles.muted}>{t.staff.queueEmpty[view]}</p>}
      {state.status === "ready" && state.cases.length > 0 && (
        <ul className={styles.caseList}>
          {state.cases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={styles.caseItem}
                data-selected={c.id === selectedCaseId ? "true" : "false"}
                data-unread={c.unreadCount > 0 ? "true" : "false"}
                onClick={() => onSelectCase(c.id)}
              >
                <span className={styles.caseItemTop}>
                  <span className={styles.caseReference}>{c.reference}</span>
                  <span className={styles.caseItemBadges}>
                    <UnreadBadge count={c.unreadCount} one={t.staff.unreadOne} many={t.staff.unreadMany} />
                    {c.incidentId && (
                      <span className={styles.incidentTag} title={c.incidentTitle ?? undefined}>
                        {t.staff.incidents.tag}
                      </span>
                    )}
                    <StatusBadge status={c.status} labels={t.staff.status} />
                  </span>
                </span>
                <span className={styles.caseSubject}>{c.subject}</span>
                <span className={styles.caseMeta}>
                  {c.customerId} · {t.category[c.category]} · {t.staff.priority[c.priority]} · {formatMessageTime(c.lastMessageAt)}
                </span>
                <span className={styles.caseMeta}>
                  {t.staff.responsible}: {c.assignedAgentId ?? t.staff.unassigned}
                  {c.assignedAgentId === identity.staffId ? ` (${t.staff.you})` : ""}
                </span>
                {c.awaitingReplySince && (
                  <span className={styles.attention} data-testid="awaiting-reply">
                    {fill(t.staff.awaitingReply, { age: formatDuration(c.awaitingReplySince) })}
                  </span>
                )}
                {c.status === "waiting_customer" && c.lastStaffMessageAt && (
                  <span className={styles.caseMeta}>{fill(t.staff.waitingCustomerSince, { age: formatDuration(c.lastStaffMessageAt) })}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.status === "ready" && state.more && (
        <button type="button" className={styles.secondaryButton} onClick={loadMore}>
          {t.staff.loadMore}
        </button>
      )}
    </section>
  );
}
