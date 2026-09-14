import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NewRequestForm } from "./NewRequestForm";
import { identity, message, mockFetch, summary, attachment } from "./test-utils";

const withdrawal = {
  kind: "withdrawal" as const,
  reference: "WD-48213",
  title: "Saque 250 USDT",
  status: "Em processamento",
  occurredAt: new Date().toISOString(),
  amount: "250.00",
  currency: "USDT",
  facts: [{ label: "Destino", value: "TX7f…9k2Q" }],
  activeCaseId: null as string | null,
  activeCaseReference: null as string | null,
};

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

  describe("contextual entry from a record (PH-4.2, §4.2)", () => {
    test("shows the record card, preselects the topic and sends the record with the request; the card can be removed", async () => {
      const created = { ...summary(), messages: [message()], record: null };
      const { requests } = mockFetch((request) => (request.url === "/api/support/records" ? { body: { records: { state: "available", source: "simulated", fetchedAt: "", data: [withdrawal] } } } : { status: 201, body: created }));
      const onCreated = vi.fn();
      render(<NewRequestForm identity={identity} onCreated={onCreated} record={withdrawal} />);
      expect(screen.getByTestId("request-record").textContent).toContain("Saque 250 USDT");
      expect((screen.getByLabelText("Depósitos e saques") as HTMLInputElement).checked).toBe(true);

      fireEvent.change(screen.getByLabelText("Conte o que está acontecendo"), { target: { value: "Ainda não chegou" } });
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      await waitFor(() => expect(onCreated).toHaveBeenCalled());
      const post = requests.find((r) => r.method === "POST");
      expect(post?.body).toMatchObject({ category: "deposits_withdrawals", record: { kind: "withdrawal", reference: "WD-48213" } });
    });

    test("offers to continue the active case that already exists for the record, unless it is a different issue", async () => {
      const active = { ...withdrawal, activeCaseId: "11111111-1111-4111-8111-111111111111", activeCaseReference: "SUP-000001" };
      mockFetch(() => ({ body: { records: { state: "available", source: "simulated", fetchedAt: "", data: [active] } } }));
      const onOpenCase = vi.fn();
      render(<NewRequestForm identity={identity} onCreated={() => {}} record={withdrawal} onOpenCase={onOpenCase} />);
      expect(await screen.findByText(/já tem uma conversa em andamento \(SUP-000001\)/)).toBeDefined();
      fireEvent.change(screen.getByLabelText("Conte o que está acontecendo"), { target: { value: "Outra coisa" } });
      expect((screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Continuar conversa" }));
      expect(onOpenCase).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");

      fireEvent.click(screen.getByRole("button", { name: "É outro problema" }));
      expect(screen.queryByText(/já tem uma conversa em andamento/)).toBeNull();
      expect((screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Remover registro" }));
      expect(screen.queryByTestId("request-record")).toBeNull();
      expect(screen.getByText(/pergunta será geral/)).toBeDefined();
    });
  });

  test("PH-9.3: files attached before the case exists are uploaded on their own and linked by the creation (BL-010)", async () => {
    const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const created = { ...summary(), messages: [message({ attachments: [attachment()] })] };
    const { requests } = mockFetch((request) => (request.url === "/api/support/attachments" ? { status: 201, body: attachment({ caseId: null, messageId: null }) } : { status: 201, body: created }));
    const onCreated = vi.fn();
    render(<NewRequestForm identity={identity} onCreated={onCreated} />);
    fireEvent.click(screen.getByLabelText("Outro assunto"));
    fireEvent.change(screen.getByLabelText("Conte o que está acontecendo"), { target: { value: "Segue o comprovante" } });
    fireEvent.change(screen.getByLabelText("Anexar arquivo"), { target: { files: [new File([PNG_BYTES], "comprovante.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("comprovante.png").closest("li")?.getAttribute("data-state")).toBe("ready"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(requests[0]).toMatchObject({ url: "/api/support/attachments", method: "POST" });
    expect(requests[0].headers["x-simulated-customer-id"]).toBe("cust-test");
    expect(requests[1].body).toMatchObject({ category: "other", message: "Segue o comprovante", attachmentIds: [attachment().id] });
  });
});
