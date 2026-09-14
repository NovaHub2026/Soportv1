import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { mockFetch } from "@/features/support/test-utils";
import { AccessRecoveryForm } from "./AccessRecoveryForm";

afterEach(() => vi.restoreAllMocks());

describe("AccessRecoveryForm (PH-7.1, §4.5)", () => {
  test("sends contact and description without any identity header and shows the reference and next step", async () => {
    const { requests } = mockFetch(() => ({ status: 201, body: { reference: "REC-000001", receivedAt: new Date().toISOString(), nextStep: "orbit_verification", delivery: "simulated" } }));
    const onClose = vi.fn();
    render(<AccessRecoveryForm onClose={onClose} />);
    expect(screen.getByRole("note").textContent).toContain("senha");
    const submit = screen.getByRole("button", { name: "Enviar pedido" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/E-mail ou telefone/), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText(/O que está acontecendo/), { target: { value: "O código de verificação nunca chega." } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);
    expect((await screen.findByTestId("recovery-reference")).textContent).toBe("REC-000001");
    expect(requests[0].url).toBe("/api/public/access-recovery");
    expect(Object.keys(requests[0].headers).some((h) => h.startsWith("x-simulated"))).toBe(false);
    expect(requests[0].body).toMatchObject({ contact: "alice@example.com", description: "O código de verificação nunca chega.", clientRequestId: expect.any(String) });
    expect(screen.getByText(/Próximo passo: a equipe entra em contato/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onClose).toHaveBeenCalled();
  });

  test("explains a rate limit honestly and keeps the form", async () => {
    mockFetch(() => ({ status: 429, body: { error: "too_many_requests", retryAfterSeconds: 1800 } }));
    render(<AccessRecoveryForm onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/E-mail ou telefone/), { target: { value: "+55 11 99999-1234" } });
    fireEvent.change(screen.getByLabelText(/O que está acontecendo/), { target: { value: "Perdi o acesso ao telefone cadastrado." } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Enviar pedido" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect((await screen.findByRole("alert")).textContent).toContain("30 min");
    expect(screen.getByLabelText(/E-mail ou telefone/)).toBeDefined();
  });
});
