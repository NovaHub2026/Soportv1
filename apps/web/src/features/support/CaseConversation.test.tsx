import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CaseConversation } from "./CaseConversation";
import { identity, message, mockFetch, summary } from "./test-utils";

afterEach(() => vi.restoreAllMocks());

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

  test("a closed case shows the closure notice instead of the composer", async () => {
    mockFetch(() => ({ body: { ...detail, status: "closed" } }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    expect(await screen.findByText(/Esta conversa foi encerrada/)).toBeDefined();
    expect(screen.queryByLabelText("Sua mensagem")).toBeNull();
  });

  test("reports when the conversation cannot be loaded", async () => {
    mockFetch(() => ({ status: 404, body: { message: "case_not_found" } }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar a conversa.");
  });
});
