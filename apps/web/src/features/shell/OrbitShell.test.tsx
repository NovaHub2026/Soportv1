import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { message, mockFetch, summary } from "@/features/support/test-utils";
import { OrbitShell } from "./OrbitShell";

const streams = vi.hoisted(() => ({ opened: 0 }));
vi.mock("@/lib/sse", () => ({
  subscribeStream: () => {
    streams.opened += 1;
    return () => {};
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("OrbitShell", () => {
  test("FND-0011: switching the simulated customer never leaves the previous customer's conversation on screen", async () => {
    const alice = summary({ customerId: "cust-alice", subject: "Segredo da Alice" });
    mockFetch((request) => {
      const customer = request.headers["x-simulated-customer-id"];
      if (customer !== "cust-alice") return request.url === "/api/support/cases" ? { body: [] } : { status: 404, body: { message: "case_not_found" } };
      if (request.url === "/api/support/cases") return { body: [alice] };
      if (request.url.endsWith("/read")) return { body: alice };
      return { body: { ...alice, messages: [message({ body: "Meu saldo é confidencial" })] } };
    });
    render(<OrbitShell />);

    fireEvent.click(await screen.findByRole("button", { name: /Segredo da Alice/ }));
    expect(await screen.findByText("Meu saldo é confidencial")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Conta simulada"), { target: { value: "cust-bruno" } });
    await waitFor(() => expect(screen.queryByText("Meu saldo é confidencial")).toBeNull());
    expect(screen.queryByText(/SUP-000001/)).toBeNull();
    expect(screen.getAllByRole("note").some((n) => n.textContent?.includes("Bruno Lima"))).toBe(true);
    expect(await screen.findByText("Você ainda não falou com o suporte.")).toBeDefined();
  });

  test("PH-4.2: the host lists the customer's records and 'Preciso de ajuda' opens the request about that record", async () => {
    const withdrawal = { kind: "withdrawal", reference: "WD-48213", title: "Saque 250 USDT", status: "Em processamento", occurredAt: new Date().toISOString(), amount: "250.00", currency: "USDT", facts: [], activeCaseId: null, activeCaseReference: null };
    mockFetch((request) => {
      if (request.url === "/api/support/records") return { body: { records: { state: "available", source: "simulated", fetchedAt: "", data: [withdrawal] } } };
      return { body: [] };
    });
    render(<OrbitShell />);
    expect(await screen.findByText(/Saque · Saque 250 USDT/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Preciso de ajuda: Saque 250 USDT" }));
    expect(await screen.findByText("Como podemos ajudar?")).toBeDefined();
    expect(screen.getByTestId("request-record").textContent).toContain("WD-48213");
  });


  test("PH-6.1: the host shows unread notifications and clicking one opens the conversation", async () => {
    const alice = summary({ customerId: "cust-alice", subject: "Caso com aviso" });
    let unread = 1;
    mockFetch((request) => {
      if (request.url === "/api/support/notifications") return { body: { notifications: [{ id: "n1", caseId: alice.id, caseReference: "SUP-000001", kind: "staff_reply", createdAt: new Date().toISOString(), readAt: unread ? null : new Date().toISOString() }], unread } };
      if (request.url.endsWith("/read")) {
        unread = 0;
        return { body: alice };
      }
      if (request.url === "/api/support/cases") return { body: [alice] };
      return { body: { ...alice, messages: [message({ body: "Resposta da Ana", authorType: "staff", authorId: "staff-ana", authorName: "Ana" })], unreadCount: 1, record: null } };
    });
    render(<OrbitShell />);
    expect((await screen.findByTestId("notifications-badge")).textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Notificações: 1 não lidas" }));
    fireEvent.click(await screen.findByRole("button", { name: /Nova resposta em SUP-000001/ }));
    expect(await screen.findByText("Resposta da Ana")).toBeDefined();
  });

  test("FND-0029: a 'Preciso de ajuda' entry never carries over when the simulated customer changes", async () => {
    const withdrawal = { kind: "withdrawal", reference: "WD-48213", title: "Saque 250 USDT", status: "Em processamento", occurredAt: new Date().toISOString(), amount: "250.00", currency: "USDT", facts: [], activeCaseId: null, activeCaseReference: null };
    mockFetch((request) => {
      const customer = request.headers["x-simulated-customer-id"];
      if (request.url === "/api/support/records") return { body: { records: { state: "available", source: "simulated", fetchedAt: "", data: customer === "cust-alice" ? [withdrawal] : [] } } };
      return { body: [] };
    });
    render(<OrbitShell />);
    fireEvent.click(await screen.findByRole("button", { name: "Preciso de ajuda: Saque 250 USDT" }));
    expect(await screen.findByTestId("request-record")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Conta simulada"), { target: { value: "cust-bruno" } });
    await waitFor(() => expect(screen.queryByTestId("request-record")).toBeNull());
    expect(await screen.findByText("Você ainda não falou com o suporte.")).toBeDefined();
    expect(screen.queryByText(/WD-48213/)).toBeNull();
  });

  test("FND-0034: host re-renders (panel toggles, records reloads) do not re-open the customer stream", async () => {
    mockFetch((request) => (request.url === "/api/support/notifications" ? { body: { notifications: [], unread: 0 } } : { body: [] }));
    render(<OrbitShell />);
    await screen.findByText("Você ainda não falou com o suporte.");
    const opened = streams.opened;
    expect(opened).toBeGreaterThan(0);
    const toggle = () => document.querySelector<HTMLButtonElement>('button[aria-controls="support-panel"]')!;
    for (let i = 0; i < 3; i += 1) fireEvent.click(toggle());
    await waitFor(() => expect(toggle().getAttribute("aria-expanded")).toBe("true"));
    expect(streams.opened).toBe(opened);
  });

  test("FND-0035: switching the simulated customer never shows the previous customer's notifications, even when the new list fails", async () => {
    mockFetch((request) => {
      const customer = request.headers["x-simulated-customer-id"];
      if (request.url === "/api/support/notifications") {
        if (customer !== "cust-alice") return { status: 500, body: { error: "boom" } };
        return { body: { notifications: [{ id: "n1", caseId: "c1", caseReference: "SUP-000001", kind: "staff_reply", createdAt: new Date().toISOString(), readAt: null }], unread: 1 } };
      }
      return { body: [] };
    });
    render(<OrbitShell />);
    expect((await screen.findByTestId("notifications-badge")).textContent).toBe("1");
    fireEvent.change(screen.getByLabelText("Conta simulada"), { target: { value: "cust-bruno" } });
    await waitFor(() => expect(screen.queryByTestId("notifications-badge")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }));
    expect(await screen.findByText("Não foi possível carregar as notificações.")).toBeDefined();
    expect(screen.queryByText(/SUP-000001/)).toBeNull();
  });
  test("PH-7.1: 'Não consigo acessar minha conta' is reachable from the host and sends no simulated identity", async () => {
    const { requests } = mockFetch((request) => (request.url === "/api/public/access-recovery" ? { status: 201, body: { reference: "REC-000007", receivedAt: new Date().toISOString(), nextStep: "orbit_verification", delivery: "simulated" } } : { body: [] }));
    render(<OrbitShell />);
    fireEvent.click(screen.getByRole("button", { name: "Não consigo acessar minha conta" }));
    fireEvent.change(await screen.findByLabelText(/E-mail ou telefone/), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText(/O que está acontecendo/), { target: { value: "A conta parece bloqueada desde ontem." } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Enviar pedido" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect((await screen.findByTestId("recovery-reference")).textContent).toBe("REC-000007");
    const sent = requests.find((r) => r.url === "/api/public/access-recovery")!;
    expect(Object.keys(sent.headers).some((h) => h.startsWith("x-simulated"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("Área de negociação")).toBeDefined();
  });
  test("PH-7.3: 'Sair' leaves a neutral picker with nothing of the previous customer on screen or in storage, and 'Entrar' starts clean", async () => {
    const alice = summary({ customerId: "cust-alice", subject: "Segredo da Alice" });
    mockFetch((request) => {
      const customer = request.headers["x-simulated-customer-id"];
      if (request.url === "/api/support/notifications") return { body: { notifications: customer === "cust-alice" ? [{ id: "n1", caseId: alice.id, caseReference: "SUP-000001", kind: "staff_reply", createdAt: new Date().toISOString(), readAt: null }] : [], unread: customer === "cust-alice" ? 1 : 0 } };
      if (request.url === "/api/support/cases") return { body: customer === "cust-alice" ? [alice] : [] };
      return { body: [] };
    });
    window.sessionStorage.setItem("orbit-support.pending.cust-alice.x", JSON.stringify([{ id: "p1" }]));
    render(<OrbitShell />);
    expect(await screen.findByText(/Segredo da Alice/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(await screen.findByTestId("signed-out")).toBeDefined();
    expect(screen.getByText("Você saiu. Este dispositivo não mostra mais suas conversas.")).toBeDefined();
    expect(screen.queryByText(/Segredo da Alice/)).toBeNull();
    expect(screen.queryByText(/SUP-000001/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Notificações/ })).toBeNull();
    expect(window.localStorage.getItem("orbit-support.simulated-customer")).toBeNull();
    expect(window.sessionStorage.getItem("orbit-support.pending.cust-alice.x")).toBeNull();
    // The recovery route stays reachable while signed out.
    expect(screen.getByRole("button", { name: "Não consigo acessar minha conta" })).toBeDefined();
    fireEvent.change(screen.getByLabelText("Conta simulada"), { target: { value: "cust-bruno" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Você ainda não falou com o suporte.")).toBeDefined();
    expect(screen.queryByText(/Segredo da Alice/)).toBeNull();
  });

  test("PH-7.3: the host signs out by itself after the idle timeout and says why", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockFetch(() => ({ body: [] }));
      render(<OrbitShell />);
      expect(screen.getByRole("button", { name: "Sair" })).toBeDefined();
      await act(async () => {
        vi.advanceTimersByTime(30 * 60_000 + 1000);
      });
      expect(screen.getByTestId("signed-out")).toBeDefined();
      expect(screen.getByText("Sua sessão foi encerrada por inatividade.")).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
