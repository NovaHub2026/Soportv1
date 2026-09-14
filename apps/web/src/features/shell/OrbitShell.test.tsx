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
    expect(screen.getByRole("note").textContent).toContain("Bruno Lima");
    expect(await screen.findByText("Você ainda não falou com o suporte.")).toBeDefined();
  });
});
