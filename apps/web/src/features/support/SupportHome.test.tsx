import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { StreamHandlers } from "@/lib/sse";
import { SupportHome } from "./SupportHome";
import { identity, mockFetch, summary } from "./test-utils";

const streams: Array<{ path: string; handlers: StreamHandlers }> = [];
vi.mock("@/lib/sse", () => ({
  subscribeStream: (path: string, _headers: Record<string, string>, handlers: StreamHandlers) => {
    streams.push({ path, handlers });
    return () => {};
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  streams.length = 0;
});

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

  test("shows unread counts and refreshes the lists when the customer stream announces a change", async () => {
    let unread = 2;
    const { requests } = mockFetch(() => ({ body: [summary({ unreadCount: unread })] }));
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    expect(await screen.findByLabelText("2 novas mensagens")).toHaveProperty("textContent", "2");
    expect(streams.map((s) => s.path)).toEqual(["/support/cases/stream"]);

    unread = 0;
    act(() => {
      streams[0].handlers.onEvent("case.updated", {
        type: "case.updated",
        caseId: summary().id,
        customerId: identity.customerId,
        summary: summary(),
        at: new Date().toISOString(),
      });
    });
    await waitFor(() => expect(requests.filter((r) => r.url === "/api/support/cases")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByLabelText("2 novas mensagens")).toBeNull());
  });

  test("offers a retry when the list cannot be loaded", async () => {
    let calls = 0;
    mockFetch((request) => {
      if (request.url !== "/api/support/cases") return { status: 404, body: null };
      calls += 1;
      return calls === 1 ? { status: 500, body: { error: "boom" } } : { body: [summary()] };
    });
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    await screen.findByText("Não foi possível carregar suas conversas.");
    fireEvent.click(screen.getAllByRole("button", { name: "Tentar novamente" })[0]); // the outbox offers its own retry too
    await waitFor(() => expect(screen.getByText(/SUP-000001/)).toBeDefined());
  });

  test("PH-5.4: shows availability from the configured schedule and says when it is still a working default", async () => {
    mockFetch((request) =>
      request.url === "/api/support/availability"
        ? { body: { openNow: false, timezone: "America/Sao_Paulo", today: { open: "09:00", close: "18:00" }, nextOpening: { weekday: "thu", open: "09:00" }, workingDefault: true, checkedAt: "" } }
        : { body: [] },
    );
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    const line = await screen.findByTestId("availability");
    expect(line.textContent).toContain("Atendimento fechado agora.");
    expect(line.textContent).toContain("Hoje: 09:00–18:00.");
    expect(line.textContent).toContain("Próximo atendimento: quinta às 09:00.");
    expect(line.textContent).toContain("ainda não configurado pela operação");
  });


  test("PH-6.2: shows the e-mail preference and the labeled simulated outbox, and saves the preference", async () => {
    const { requests } = mockFetch((request) => {
      if (request.url === "/api/support/preferences") return { body: { emailNotifications: true, updatedAt: null } };
      if (request.url === "/api/support/emails") return { body: { delivery: "simulated", emails: [{ id: "e1", caseId: "a", kind: "staff_reply", toMasked: "a***@e***.com", subject: "Nova resposta no seu caso SUP-000001", link: "/?case=a", delivery: "simulated", createdAt: new Date().toISOString() }] } };
      return { body: [] };
    });
    const onOpenCase = vi.fn();
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={onOpenCase} />);
    const outbox = await screen.findByTestId("email-outbox");
    expect(outbox.textContent).toContain("Simulação");
    expect(outbox.textContent).toContain("para a***@e***.com");
    fireEvent.click(screen.getByRole("button", { name: /Nova resposta no seu caso SUP-000001/ }));
    expect(onOpenCase).toHaveBeenCalledWith("a");
    const toggle = (await screen.findByRole("checkbox", { name: /Receber e-mail/ })) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    await waitFor(() => expect(requests.some((r) => r.method === "PUT" && r.url === "/api/support/preferences" && (r.body as { emailNotifications: boolean }).emailNotifications === false)).toBe(true));
  });

  test("FND-0041: a failed preference save is reported and the previous value kept; an outbox that cannot load says so", async () => {
    mockFetch((request) => {
      if (request.url === "/api/support/preferences" && request.method === "PUT") return { status: 500, body: { error: "boom" } };
      if (request.url === "/api/support/preferences") return { body: { emailNotifications: true, updatedAt: null } };
      if (request.url === "/api/support/emails") return { status: 500, body: { error: "boom" } };
      return { body: [] };
    });
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    const checkbox = (await screen.findByRole("checkbox", { name: /Receber e-mail/ })) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(await screen.findByText(/Não foi possível salvar a preferência/)).toBeDefined();
    await waitFor(() => expect((screen.getByRole("checkbox", { name: /Receber e-mail/ }) as HTMLInputElement).checked).toBe(true));
    expect(await screen.findByText("Não foi possível carregar a lista de e-mails.")).toBeDefined();
    expect(screen.queryByText("Nenhum e-mail ainda.")).toBeNull();
  });
});
