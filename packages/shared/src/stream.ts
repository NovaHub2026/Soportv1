import type { CaseMessage, CaseSummary } from "./cases.js";

/** Events pushed to open conversations and staff queues (ADR-0004). `data` of each SSE event is one of these. */
export const STREAM_EVENT_TYPES = ["case.updated", "message.created", "heartbeat"] as const;
export type StreamEventType = (typeof STREAM_EVENT_TYPES)[number];

export interface CaseUpdatedEvent {
  type: "case.updated";
  caseId: string;
  customerId: string;
  summary: CaseSummary;
  at: string;
}

export interface MessageCreatedEvent {
  type: "message.created";
  caseId: string;
  customerId: string;
  message: CaseMessage;
  at: string;
}

export interface HeartbeatEvent {
  type: "heartbeat";
  at: string;
}

export type CaseStreamEvent = CaseUpdatedEvent | MessageCreatedEvent;
export type StreamEvent = CaseStreamEvent | HeartbeatEvent;

export function isStreamEvent(value: unknown): value is StreamEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (STREAM_EVENT_TYPES as readonly string[]).includes((value as { type: string }).type)
  );
}
