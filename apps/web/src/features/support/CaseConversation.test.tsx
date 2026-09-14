import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { StreamHandlers } from "@/lib/sse";
import { CaseConversation } from "./CaseConversation";
import { identity, message, mockFetch, summary } from "./test-utils";

// The live stream is exercised through its handlers; the transport itself is tested in lib/sse.test.ts.
const streams: Array<{ path: string; headers: Record<string, string>; handlers: StreamHandlers }> = [];
vi.mock("@/lib/sse", () => ({
  subscribeStream: (path: string, headers: Record<string, string>, handlers: StreamHandlers) => {
    streams.push({ path, headers, handlers });
    return () => {};
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  streams.length = 0;
});

const detail = {
  ...summary({ status: "in_progress", assignedAgentId: "staff-ana", subject: "Saque pendente" }),
  messages: [
    message({ id: "m1", body: "Meu saque não chegou" }),
    message({ id: "m2", authorType: "staff", authorId: "staff-ana", authorName: "Ana", body: "Olá! Já estou verificando." }),
  ],
};

describe("CaseConversation", () => {
  test("shows reference, status and both sides of the conversation, attributing staff replies", async () => {
    mockFetch(() => ({ body: detail }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);

    expect(await screen.findByText(/SUP-000001/)).toBeDefined();
    expect(screen.getByText("Em atendimento")).toBeDefined();
    expect(screen.getByText("Saque pendente")).toBeDefined();
    expect(screen.getByText("Meu saque não chegou")).toBeDefined();
    expect(screen.getByText("Ana")).toBeDefined();
    expect(screen.getByText("Olá! Já estou verificando.")).toBeDefined();
  });

  test("a failed send is marked as not sent and can be retried with the same client message id", async () => {
    let posts = 0;
    let stored: ReturnType<typeof message> | null = null;
    const { requests } = mockFetch((request) => {
      // GET reflects what the server stored so far; the component re-reads after a successful send.
      if (request.method === "GET") return { body: stored ? { ...detail, messages: [...detail.messages, stored] } : detail };
      posts += 1;
      if (posts === 1) return { status: 503, body: { error: "unavailable" } };
      const body = request.body as { body: string; clientMessageId: string };
      stored = message({ id: "m3", body: body.body, clientMessageId: body.clientMessageId });
      return { status: 201, body: stored };
    });
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    await screen.findByText(/SUP-000001/);

    fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Segue o comprovante" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Não enviada")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));

    await waitFor(() => expect(screen.queryByText("Não enviada")).toBeNull());
    const postBodies = requests.filter((r) => r.method === "POST").map((r) => r.body as { clientMessageId: string });
    expect(postBodies).toHaveLength(2);
    expect(postBodies[0].clientMessageId).toBe(postBodies[1].clientMessageId);
    expect(screen.getByText("Segue o comprovante")).toBeDefined();
  });

  test("subscribes to the case stream with the identity header and shows a pushed staff message at once", async () => {
    mockFetch(() => ({ body: detail }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    await screen.findByText(/SUP-000001/);

    expect(streams).toHaveLength(1);
    expect(streams[0].path).toBe(`/support/cases/${detail.id}/stream`);
    expect(streams[0].headers["x-simulated-customer-id"]).toBe("cust-test");

    const pushed = message({ id: "m9", authorType: "staff", authorId: "staff-ana", authorName: "Ana", body: "Chegou ao vivo" });
    act(() => {
      streams[0].handlers.onEvent("message.created", {
        type: "message.created",
        caseId: detail.id,
        customerId: identity.customerId,
        message: pushed,
        at: new Date().toISOString(),
      });
    });
    expect(screen.getByText("Chegou ao vivo")).toBeDefined();
  });

  test("marks the case read after loading unread replies and shows the live connection state", async () => {
    const { requests } = mockFetch((request) =>
      request.url.endsWith("/read") ? { body: summary({ customerLastReadAt: new Date().toISOString() }) } : { body: { ...detail, unreadCount: 1 } },
    );
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    await screen.findByText(/SUP-000001/);
    await waitFor(() => expect(requests.some((r) => r.method === "POST" && r.url === `/api/support/cases/${detail.id}/read`)).toBe(true));

    expect(screen.getByRole("status", { name: "" }).textContent).toContain("Conectando…");
    act(() => streams[0].handlers.onStatus?.("connected"));
    expect(screen.getByText("Ao vivo")).toBeDefined();
    act(() => streams[0].handlers.onStatus?.("reconnecting"));
    expect(screen.getByText("Reconectando…")).toBeDefined();
  });

  test("a message that failed while offline is resent automatically, once, when the stream reconnects", async () => {
    let posts = 0;
    let stored: ReturnType<typeof message> | null = null;
    const { requests } = mockFetch((request) => {
      if (request.method === "GET") return { body: stored ? { ...detail, messages: [...detail.messages, stored] } : detail };
      if (request.url.endsWith("/read")) return { body: summary() };
      posts += 1;
      if (posts === 1) return { status: 503, body: { error: "offline" } };
      const body = request.body as { body: string; clientMessageId: string };
      stored = message({ id: "m7", body: body.body, clientMessageId: body.clientMessageId });
      return { status: 201, body: stored };
    });
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    await screen.findByText(/SUP-000001/);

    fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Ainda estou aqui" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Não enviada");

    // The browser regains connectivity: the `online` event alone must trigger the retry (the stream may lag).
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(screen.queryByText("Não enviada")).toBeNull());
    const messagePosts = requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages"));
    expect(messagePosts).toHaveLength(2);
    expect((messagePosts[0].body as { clientMessageId: string }).clientMessageId).toBe((messagePosts[1].body as { clientMessageId: string }).clientMessageId);
    expect(screen.getAllByText("Ainda estou aqui")).toHaveLength(1);
  });

  test("resyncs on every (re)connect and never shows a pushed message twice (PH-2.4)", async () => {
    const { requests } = mockFetch(() => ({ body: detail }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    await screen.findByText(/SUP-000001/);
    const getsBefore = requests.filter((r) => r.method === "GET").length;

    act(() => streams[0].handlers.onStatus?.("connected"));
    await waitFor(() => expect(requests.filter((r) => r.method === "GET").length).toBeGreaterThan(getsBefore));

    // The same message pushed twice (e.g. once before and once after a reconnect) renders once.
    const pushed = message({ id: "m-dup", authorType: "staff", authorId: "staff-ana", authorName: "Ana", body: "Só uma vez" });
    const event = { type: "message.created", caseId: detail.id, customerId: identity.customerId, message: pushed, at: new Date().toISOString() };
    act(() => {
      streams[0].handlers.onEvent("message.created", event);
      streams[0].handlers.onEvent("message.created", event);
    });
    expect(screen.getAllByText("Só uma vez")).toHaveLength(1);
  });

  test("a resolved case offers 'Ainda preciso de ajuda', which sends a message that reactivates it (PH-3.1)", async () => {
    let status: "resolved" | "in_progress" = "resolved";
    const { requests } = mockFetch((request) => {
      if (request.method === "POST" && request.url.endsWith("/messages")) {
        status = "in_progress";
        const body = request.body as { body: string; clientMessageId: string };
        return { status: 201, body: message({ id: "m-help", body: body.body, clientMessageId: body.clientMessageId }) };
      }
      if (request.url.endsWith("/read")) return { body: summary() };
      return { body: { ...detail, status, resolutionReason: status === "resolved" ? "solved" : null } };
    });
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    expect(await screen.findByText("Resolvido")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Ainda preciso de ajuda" }));

    await waitFor(() => expect(screen.getByText("Em atendimento")).toBeDefined());
    const post = requests.find((r) => r.method === "POST" && r.url.endsWith("/messages"));
    expect((post?.body as { body: string }).body).toBe("Ainda preciso de ajuda.");
    expect(screen.queryByRole("button", { name: "Ainda preciso de ajuda" })).toBeNull();
  });

  test("a closed case shows the closure notice and opens a linked follow-up instead of the composer (PH-3.4)", async () => {
    const child = { ...summary({ id: "99999999-9999-4999-8999-999999999999", reference: "SUP-000002", parentCaseId: detail.id, parentReference: "SUP-000001" }), messages: [] };
    const { requests } = mockFetch((request) => (request.url.endsWith("/follow-up") ? { status: 201, body: child } : { body: { ...detail, status: "closed" } }));
    const onOpenCase = vi.fn();
    render(<CaseConversation identity={identity} caseId={detail.id} onOpenCase={onOpenCase} />);
    expect(await screen.findByText(/Esta conversa foi encerrada/)).toBeDefined();
    expect(screen.queryByLabelText("Sua mensagem")).toBeNull();

    fireEvent.change(screen.getByLabelText("O que ainda precisa"), { target: { value: "Voltou a acontecer." } });
    fireEvent.click(screen.getByRole("button", { name: "Preciso de mais ajuda" }));
    await waitFor(() => expect(onOpenCase).toHaveBeenCalledWith(child.id));
    const post = requests.find((r) => r.url.endsWith("/follow-up"));
    expect(post?.body).toMatchObject({ message: "Voltou a acontecer." });
  });

  test("a follow-up shows which case it continues and can open it", async () => {
    mockFetch(() => ({ body: { ...detail, parentCaseId: "77777777-7777-4777-8777-777777777777", parentReference: "SUP-000001", reference: "SUP-000002" } }));
    const onOpenCase = vi.fn();
    render(<CaseConversation identity={identity} caseId={detail.id} onOpenCase={onOpenCase} />);
    expect(await screen.findByText(/Continuação do caso SUP-000001/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Ver caso anterior" }));
    expect(onOpenCase).toHaveBeenCalledWith("77777777-7777-4777-8777-777777777777");
  });

  test("reports when the conversation cannot be loaded", async () => {
    mockFetch(() => ({ status: 404, body: { message: "case_not_found" } }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar a conversa.");
  });

  describe("Cycle Audit 1 regressions", () => {
    test("FND-0002: a poll that started before a send never hides the sent message when it resolves late", async () => {
      let release: ((value: unknown) => void) | undefined;
      let gets = 0;
      let stored: ReturnType<typeof message> | null = null;
      mockFetch(async (request) => {
        if (request.url.endsWith("/read")) return { body: summary() };
        if (request.method === "GET") {
          gets += 1;
          if (gets === 2) {
            await new Promise((resolve) => (release = resolve));
            return { body: detail }; // stale: taken before the send
          }
          return { body: stored ? { ...detail, messages: [...detail.messages, stored] } : detail };
        }
        const body = request.body as { body: string; clientMessageId: string };
        stored = message({ id: "m-late", body: body.body, clientMessageId: body.clientMessageId });
        return { status: 201, body: stored };
      });
      render(<CaseConversation identity={identity} caseId={detail.id} />);
      await screen.findByText(/SUP-000001/);

      // A case.updated event starts a poll that will hang until released.
      act(() => streams[0].handlers.onEvent("case.updated", { type: "case.updated", caseId: detail.id, customerId: identity.customerId, summary: detail, at: "" }));
      await waitFor(() => expect(gets).toBe(2));
      fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Chegou depois" } });
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      await waitFor(() => expect(gets).toBe(3));
      await screen.findByText("Chegou depois");

      await act(async () => {
        release?.(undefined);
        await Promise.resolve();
      });
      expect(screen.getAllByText("Chegou depois")).toHaveLength(1);
    });

    test("FND-0011: when the case stops being this customer's, the conversation is cleared and nothing is retried", async () => {
      let forbidden = false;
      const { requests } = mockFetch((request) => {
        if (request.url.endsWith("/read")) return { body: summary() };
        if (request.method === "GET") return forbidden ? { status: 404, body: { message: "case_not_found" } } : { body: detail };
        return { status: 503, body: {} };
      });
      render(<CaseConversation identity={identity} caseId={detail.id} />);
      await screen.findByText(/SUP-000001/);
      fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Segredo" } });
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      await screen.findByText("Não enviada");

      forbidden = true;
      act(() => streams[0].handlers.onEvent("case.updated", { type: "case.updated", caseId: detail.id, customerId: identity.customerId, summary: detail, at: "" }));
      expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar a conversa.");
      expect(screen.queryByText(/SUP-000001/)).toBeNull();
      expect(screen.queryByText("Segredo")).toBeNull();
      const posts = requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages")).length;
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages")).length).toBe(posts);
    });

    test("FND-0012: a send refused because the case closed moves the text into the follow-up form instead of retrying forever", async () => {
      let closed = false;
      const { requests } = mockFetch((request) => {
        if (request.url.endsWith("/read")) return { body: summary() };
        if (request.method === "GET") return { body: { ...detail, status: closed ? "closed" : "in_progress" } };
        closed = true;
        return { status: 409, body: { statusCode: 409, message: "case_closed" } };
      });
      render(<CaseConversation identity={identity} caseId={detail.id} />);
      await screen.findByText(/SUP-000001/);
      fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Ainda não recebi" } });
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

      expect(await screen.findByText(/Esta conversa foi encerrada/)).toBeDefined();
      expect(screen.getByText(/pronta abaixo para a continuação/)).toBeDefined();
      expect((screen.getByLabelText("O que ainda precisa") as HTMLTextAreaElement).value).toBe("Ainda não recebi");
      expect(screen.queryByText("Não enviada")).toBeNull();
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages"))).toHaveLength(1);
    });

    test("FND-0012: a validation refusal is shown as refused and never auto-retried; a failed send survives leaving and coming back", async () => {
      const { requests } = mockFetch((request) => {
        if (request.url.endsWith("/read")) return { body: summary() };
        if (request.method === "GET") return { body: detail };
        const body = request.body as { body: string };
        return body.body === "inválida" ? { status: 400, body: { error: "validation_failed" } } : { status: 503, body: {} };
      });
      const first = render(<CaseConversation identity={identity} caseId={detail.id} />);
      await screen.findByText(/SUP-000001/);
      fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "inválida" } });
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      expect(await screen.findByText("Recusada pelo servidor")).toBeDefined();
      fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "sem rede" } });
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      expect(await screen.findByText("Não enviada")).toBeDefined();
      const postsBefore = requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages")).length;

      first.unmount();
      render(<CaseConversation identity={identity} caseId={detail.id} />);
      await screen.findByText(/SUP-000001/);
      expect(screen.getByText("sem rede")).toBeDefined();
      expect(screen.getByText("inválida")).toBeDefined();
      expect(screen.getByText("Recusada pelo servidor")).toBeDefined();
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      await waitFor(() => expect(requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages")).length).toBe(postsBefore + 1));
      expect((requests.at(-1)?.body as { body: string }).body).toBe("sem rede");
      fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
      expect(screen.queryByText("inválida")).toBeNull();
      window.sessionStorage.clear();
    });

    test("FND-0013: nothing is marked as read while the panel is hidden; showing it marks the unread reply", async () => {
      const { requests } = mockFetch((request) => (request.url.endsWith("/read") ? { body: summary() } : { body: { ...detail, unreadCount: 1 } }));
      const view = render(<CaseConversation identity={identity} caseId={detail.id} visible={false} />);
      await screen.findByText(/SUP-000001/);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(requests.some((r) => r.url.endsWith("/read"))).toBe(false);

      view.rerender(<CaseConversation identity={identity} caseId={detail.id} visible={true} />);
      await waitFor(() => expect(requests.some((r) => r.method === "POST" && r.url.endsWith("/read"))).toBe(true));
    });
  });

});
