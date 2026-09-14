/**
 * Server-Sent Events over `fetch` (ADR-0004). `EventSource` cannot send headers, and our identity — simulated
 * today, a session later — travels in headers, so the stream is read from `response.body` and parsed here.
 */
export type StreamStatus = "connecting" | "connected" | "reconnecting" | "closed";

export interface StreamHandlers {
  onEvent: (type: string, data: unknown) => void;
  onStatus?: (status: StreamStatus) => void;
}

export interface StreamOptions {
  /**
   * Treat the connection as lost when nothing (not even a heartbeat) arrives for this long, then reconnect.
   * A silently dead TCP connection otherwise looks "connected" forever. Server heartbeat is 15 s.
   */
  staleAfterMs?: number;
}

const DEFAULT_STALE_AFTER_MS = 40_000;

/** Incremental parser for the `text/event-stream` format: feed text, get `(type, data)` per dispatched event. */
export function createSseParser(onEvent: (type: string, data: unknown) => void) {
  let buffer = "";
  let eventType = "message";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length > 0) {
      const raw = dataLines.join("\n");
      let data: unknown = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        // not JSON: deliver the raw string
      }
      onEvent(eventType, data);
    }
    eventType = "message";
    dataLines = [];
  };

  return {
    feed(text: string) {
      buffer += text;
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (line === "") dispatch();
        else if (line.startsWith(":")) {
          // comment / keep-alive
        } else {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") eventType = value;
          else if (field === "data") dataLines.push(value);
          // `id` and `retry` are accepted and ignored: we resync on reconnect instead of replaying.
        }
        newline = buffer.indexOf("\n");
      }
    },
  };
}

const MAX_BACKOFF_MS = 15_000;
/** A reconnect cannot fix these: the identity is missing or the case is not this customer's (FND-0011). */
const TERMINAL_STATUSES = new Set([401, 403, 404]);

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * Opens `/api<path>` as an event stream and keeps it open: on any end or error it reconnects with capped
 * exponential backoff and reports status changes. Consumers resync on every `connected`.
 * Returns a function that closes the stream for good.
 */
export function subscribeStream(
  path: string,
  headers: Record<string, string>,
  handlers: StreamHandlers,
  options: StreamOptions = {},
): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  let attempt = 0;

  const run = async () => {
    while (!signal.aborted) {
      handlers.onStatus?.(attempt === 0 ? "connecting" : "reconnecting");
      // One controller per connection so a stale-connection watchdog can drop it without ending the subscription.
      const connection = new AbortController();
      const abortConnection = () => connection.abort();
      signal.addEventListener("abort", abortConnection, { once: true });
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const armWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => connection.abort(), staleAfterMs);
      };
      try {
        const response = await fetch(`/api${path}`, {
          headers: { accept: "text/event-stream", ...headers },
          cache: "no-store",
          signal: connection.signal,
        });
        if (TERMINAL_STATUSES.has(response.status)) {
          console.warn(`stream: refused with ${response.status}, not retrying`);
          break;
        }
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
        attempt = 0;
        handlers.onStatus?.("connected");
        const parser = createSseParser(handlers.onEvent);
        const reader = response.body.getReader();
        // Closing must also release a body that is not tied to the abort signal.
        const cancel = () => void reader.cancel().catch(() => {});
        connection.signal.addEventListener("abort", cancel, { once: true });
        const decoder = new TextDecoder();
        armWatchdog();
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            armWatchdog();
            parser.feed(decoder.decode(value, { stream: true }));
          }
        } finally {
          clearTimeout(watchdog);
          connection.signal.removeEventListener("abort", cancel);
        }
      } catch (error) {
        clearTimeout(watchdog);
        if (signal.aborted) break;
        console.warn("stream: connection lost", error);
      } finally {
        signal.removeEventListener("abort", abortConnection);
      }
      if (signal.aborted) break;
      attempt += 1;
      const backoff = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempt - 1, 4)) + Math.random() * 500;
      await sleep(backoff, signal);
    }
    handlers.onStatus?.("closed");
  };
  void run();

  return () => controller.abort();
}
