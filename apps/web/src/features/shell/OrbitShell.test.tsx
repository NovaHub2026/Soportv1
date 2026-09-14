import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { message, mockFetch, summary } from "@/features/support/test-utils";
import { OrbitShell } from "./OrbitShell";

vi.mock("@/lib/sse", () => ({ subscribeStream: () => () => {} }));

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

});
