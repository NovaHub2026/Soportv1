import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NewRequestForm } from "./NewRequestForm";
import { identity, message, mockFetch, summary } from "./test-utils";

afterEach(() => vi.restoreAllMocks());

describe("NewRequestForm", () => {
  test("offers the five topics and only enables sending once topic and message exist", () => {
    render(<NewRequestForm identity={identity} onCreated={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    const send = screen.getByRole<HTMLButtonElement>("button", { name: "Enviar" });
    expect(send.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("Depósitos e saques"));
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Conte o que está acontecendo"), { target: { value: "Meu saque não chegou" } });
    expect(send.disabled).toBe(false);
  });

  test("creates the case with the simulated identity header and a client message id, then hands it over", async () => {
    const created = { ...summary(), messages: [message()] };
    const { requests } = mockFetch(() => ({ status: 201, body: created }));
    const onCreated = vi.fn();
    render(<NewRequestForm identity={identity} onCreated={onCreated} />);

    fireEvent.click(screen.getByLabelText("Operações"));
    fireEvent.change(screen.getByLabelText("Conte o que está acontecendo"), { target: { value: "Operação não liquidou" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ url: "/api/support/cases", method: "POST" });
    expect(requests[0].headers["x-simulated-customer-id"]).toBe("cust-test");
    expect(requests[0].body).toMatchObject({ category: "operations", message: "Operação não liquidou" });
    expect(typeof (requests[0].body as { clientMessageId: string }).clientMessageId).toBe("string");
  });

  test("shows an error on failure and reuses the same client message id on retry (no duplicate case)", async () => {
    let attempt = 0;
    const { requests } = mockFetch(() => {
      attempt += 1;
      return attempt === 1 ? { status: 500, body: { error: "boom" } } : { status: 201, body: { ...summary(), messages: [] } };
    });
    render(<NewRequestForm identity={identity} onCreated={() => {}} />);
    fireEvent.click(screen.getByLabelText("Outro assunto"));
    fireEvent.change(screen.getByLabelText("Conte o que está acontecendo"), { target: { value: "Ajuda" } });

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(requests).toHaveLength(2));

    const ids = requests.map((r) => (r.body as { clientMessageId: string }).clientMessageId);
    expect(ids[0]).toBe(ids[1]);
  });
});
