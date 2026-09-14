import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SupportHome } from "./SupportHome";
import { identity, mockFetch, summary } from "./test-utils";

afterEach(() => vi.restoreAllMocks());

describe("SupportHome", () => {
  test("keeps the prominent talk-to-support action and groups active and previous conversations", async () => {
    mockFetch(() => ({
      body: [
        summary({ id: "a", reference: "SUP-000001", status: "in_progress", subject: "Saque pendente" }),
        summary({ id: "b", reference: "SUP-000002", status: "resolved", subject: "Bônus não creditado" }),
      ],
    }));
    const onNewRequest = vi.fn();
    const onOpenCase = vi.fn();
    render(<SupportHome identity={identity} onNewRequest={onNewRequest} onOpenCase={onOpenCase} />);

    fireEvent.click(screen.getByRole("button", { name: "Falar com o suporte" }));
    expect(onNewRequest).toHaveBeenCalled();

    expect(await screen.findByText("Conversas em andamento")).toBeDefined();
    expect(screen.getByText("Conversas anteriores")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Saque pendente/ }));
    expect(onOpenCase).toHaveBeenCalledWith("a");
  });

  test("explains an empty history without inventing a case", async () => {
    mockFetch(() => ({ body: [] }));
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    expect(await screen.findByText("Você ainda não falou com o suporte.")).toBeDefined();
  });

  test("offers a retry when the list cannot be loaded", async () => {
    let calls = 0;
    mockFetch(() => {
      calls += 1;
      return calls === 1 ? { status: 500, body: { error: "boom" } } : { body: [summary()] };
    });
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByText(/SUP-000001/)).toBeDefined());
  });
});
