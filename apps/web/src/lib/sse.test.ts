import { afterEach, describe, expect, test, vi } from "vitest";
import { createSseParser, subscribeStream } from "./sse";

afterEach(() => vi.restoreAllMocks());

describe("createSseParser", () => {
  test("dispatches typed JSON events split across chunks and ignores comments", () => {
    const events: Array<[string, unknown]> = [];
    const parser = createSseParser((type, data) => events.push([type, data]));
    parser.feed(": keep-alive\nevent: message.created\ndata: {\"a\":");
    parser.feed("1}\n\nevent: heartbeat\ndata: {\"at\":\"t\"}\n\n");
    expect(events).toEqual([
      ["message.created", { a: 1 }],
      ["heartbeat", { at: "t" }],
    ]);
  });

  test("joins multi-line data and falls back to raw text when not JSON", () => {
    const events: Array<[string, unknown]> = [];
    const parser = createSseParser((type, data) => events.push([type, data]));
    parser.feed("data: hello\ndata: world\n\n");
    expect(events).toEqual([["message", "hello\nworld"]]);
  });
});

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}

describe("subscribeStream", () => {
  test("sends identity headers, reports connected, delivers events and reconnects when the server ends the stream", async () => {
    const calls: Array<Record<string, string>> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => {
        headers[k] = v;
      });
      calls.push(headers);
      if (calls.length === 1) return streamResponse(["event: case.updated\ndata: {\"caseId\":\"c1\"}\n\n"]);
      // Second connection never ends until the client closes it (the reader is cancelled on abort).
      return new Response(new ReadableStream<Uint8Array>({ start() {} }), { status: 200 });
    });

    const events: Array<[string, unknown]> = [];
    const statuses: string[] = [];
    const stop = subscribeStream("/support/cases/c1/stream", { "x-simulated-customer-id": "cust-1" }, {
      onEvent: (type, data) => events.push([type, data]),
      onStatus: (status) => statuses.push(status),
    });

    await vi.waitFor(() => expect(events).toEqual([["case.updated", { caseId: "c1" }]]));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(calls[0]["x-simulated-customer-id"]).toBe("cust-1");
    expect(calls[0].accept).toBe("text/event-stream");
    expect(statuses.slice(0, 3)).toEqual(["connecting", "connected", "reconnecting"]);

    stop();
    await vi.waitFor(() => expect(statuses.at(-1)).toBe("closed"));
  });

  test("drops a connection that goes silent for longer than the stale budget and reconnects", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          // Never sends anything; a real network drop looks exactly like this.
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(body, { status: 200 });
    });
    const statuses: string[] = [];
    const stop = subscribeStream("/staff/cases/stream", {}, { onEvent: () => {}, onStatus: (s) => statuses.push(s) }, { staleAfterMs: 200 });
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    expect(statuses).toContain("reconnecting");
    stop();
    await vi.waitFor(() => expect(statuses.at(-1)).toBe("closed"));
  });
});
