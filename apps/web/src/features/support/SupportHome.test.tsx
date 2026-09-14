import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { StreamHandlers } from "@/lib/sse";
import { customerTimeZone, dictionary as t, localOpening } from "@/i18n";
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
  vi.useRealTimers();
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

  test("PH-5.4 / PH-10.1: shows availability from the configured schedule in the customer's own time zone", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-16T10:00:00.000Z") }); // the window is on the customer's own day (FND-0111)
    const opensAt = "2026-09-16T12:00:00.000Z";
    const closesAt = "2026-09-16T21:00:00.000Z";
    const nextOpeningAt = "2026-09-17T12:00:00.000Z";
    mockFetch((request) =>
      request.url === "/api/support/availability"
        ? { body: { openNow: false, timezone: "America/Sao_Paulo", today: { open: "09:00", close: "18:00" }, nextOpening: { weekday: "thu", open: "09:00" }, alwaysOpen: false, todayWindow: { opensAt, closesAt }, nextOpeningAt, workingDefault: true, checkedAt: "" } }
        : { body: [] },
    );
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    const line = await screen.findByTestId("availability");
    expect(line.textContent).toContain("Atendimento fechado agora.");
    // The instants are shown as this browser's clock reads them, whatever zone the test machine is in.
    expect(line.textContent).toContain(`Hoje: ${localOpening(opensAt).time}–${localOpening(closesAt).time}.`);
    const next = localOpening(nextOpeningAt);
    expect(line.textContent).toContain(`Próximo atendimento: ${t.support.home.weekdays[next.weekday]} às ${next.time}.`);
    expect(line.textContent).toContain(`Horários no seu fuso (${customerTimeZone()}).`);
    expect(line.textContent).not.toContain("configurado");
  });

  test("PH-10.1 (DEC-0039 a): a 24/7 schedule says so, with no opening to announce", async () => {
    mockFetch((request) =>
      request.url === "/api/support/availability"
        ? { body: { openNow: true, timezone: "America/Sao_Paulo", today: { open: "00:00", close: "24:00" }, nextOpening: null, alwaysOpen: true, todayWindow: { opensAt: "2026-09-16T03:00:00.000Z", closesAt: "2026-09-17T03:00:00.000Z" }, nextOpeningAt: null, workingDefault: true, checkedAt: "" } }
        : { body: [] },
    );
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    const line = await screen.findByTestId("availability");
    expect(line.textContent).toContain("Atendimento 24 horas, todos os dias.");
    expect(line.textContent).not.toContain("Hoje:");
    expect(line.textContent).not.toContain("Próximo atendimento");
  });

  test("PH-10.1: a day open around the clock in a narrowed week says so instead of 00:00–00:00", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-16T12:00:00.000Z") });
    mockFetch((request) =>
      request.url === "/api/support/availability"
        ? { body: { openNow: true, timezone: "America/Sao_Paulo", today: { open: "00:00", close: "24:00" }, nextOpening: { weekday: "sat", open: "09:00" }, alwaysOpen: false, todayWindow: { opensAt: "2026-09-16T03:00:00.000Z", closesAt: "2026-09-17T03:00:00.000Z" }, nextOpeningAt: "2026-09-19T12:00:00.000Z", workingDefault: false, checkedAt: "" } }
        : { body: [] },
    );
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    const line = await screen.findByTestId("availability");
    expect(line.textContent).toContain("Atendimento aberto agora. Hoje: atendimento 24 horas.");
    expect(line.textContent).not.toContain("00:00–00:00");
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
