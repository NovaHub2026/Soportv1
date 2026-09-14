import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { message, mockFetch, summary } from "@/features/support/test-utils";
import type { StaffIdentity } from "@/lib/staff-api";
import { StaffCaseView } from "./StaffCaseView";
import { StaffQueue } from "./StaffQueue";

afterEach(() => vi.restoreAllMocks());

const ana: StaffIdentity = { staffId: "staff-ana", displayName: "Ana Ribeiro", role: "agent" };

const detail = {
  ...summary({ subject: "Saque pendente" }),
  messages: [
    message({ id: "m1", body: "Meu saque não chegou" }),
    message({
      id: "m2",
      authorType: "staff",
      authorId: "staff-bruno",
      authorName: "Bruno Costa",
      visibility: "internal",
      body: "Verificar com Finance antes de responder.",
    }),
  ],
  events: [
    {
      id: "e1",
      caseId: summary().id,
      type: "case_created" as const,
      actorType: "customer" as const,
      actorId: "cust-test",
      data: {},
      createdAt: new Date().toISOString(),
    },
  ],
};

describe("StaffQueue", () => {
  test("requests the selected view with the simulated staff headers and lists cases", async () => {
    const { requests } = mockFetch(() => ({ body: [summary({ subject: "Saque pendente" })] }));
    const onViewChange = vi.fn();
    render(
      <StaffQueue identity={ana} view="unassigned" onViewChange={onViewChange} selectedCaseId={null} onSelectCase={() => {}} refreshToken={0} />,
    );
    expect(await screen.findByText("Saque pendente")).toBeDefined();
    expect(screen.getByText("Novo")).toBeDefined();
    expect(requests[0].url).toBe("/api/staff/cases?view=unassigned");
    expect(requests[0].headers["x-simulated-staff-id"]).toBe("staff-ana");
    expect(requests[0].headers["x-simulated-staff-role"]).toBe("agent");

    fireEvent.click(screen.getByRole("tab", { name: "Meus casos" }));
    expect(onViewChange).toHaveBeenCalledWith("mine");
  });

  test("shows how many customer messages are unread on each case", async () => {
    mockFetch(() => ({ body: [summary({ unreadCount: 3 })] }));
    render(<StaffQueue identity={ana} view="active" onViewChange={() => {}} selectedCaseId={null} onSelectCase={() => {}} refreshToken={0} />);
    expect(await screen.findByLabelText("3 novas do cliente")).toHaveProperty("textContent", "3");
  });

  test("explains an empty queue per view", async () => {
    mockFetch(() => ({ body: [] }));
    render(<StaffQueue identity={ana} view="mine" onViewChange={() => {}} selectedCaseId={null} onSelectCase={() => {}} refreshToken={0} />);
    expect(await screen.findByText("Você não tem casos ativos.")).toBeDefined();
  });
});

describe("StaffCaseView", () => {
  test("shows the conversation with internal notes visibly marked and the Orbit context as unavailable", async () => {
    mockFetch(() => ({ body: detail }));
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);

    expect(await screen.findByText(/SUP-000001/)).toBeDefined();
    expect(screen.getByText("Meu saque não chegou")).toBeDefined();
    expect(screen.getByText(/Nota interna/)).toBeDefined();
    expect(screen.getByText("Verificar com Finance antes de responder.")).toBeDefined();
    expect(screen.getByText(/integração com o Orbit ainda não foi construída/)).toBeDefined();
    expect(screen.getByText("Caso aberto pelo cliente")).toBeDefined();
  });

  test("marks customer messages read on open and tells whether the customer read the latest reply", async () => {
    const staffReplyAt = new Date(Date.now() - 60_000).toISOString();
    const { requests } = mockFetch((request) =>
      request.url.endsWith("/read")
        ? { body: summary() }
        : { body: { ...detail, unreadCount: 1, lastStaffMessageAt: staffReplyAt, customerLastReadAt: new Date().toISOString() } },
    );
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    await waitFor(() => expect(requests.some((r) => r.method === "POST" && r.url === `/api/staff/cases/${detail.id}/read`)).toBe(true));
    expect(screen.getByText(/Última resposta lida pelo cliente/)).toBeDefined();
  });

  test("take assigns the case to the current agent and notifies the workspace", async () => {
    let taken = false;
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/take")) {
        taken = true;
        return { body: summary({ assignedAgentId: "staff-ana", status: "in_progress" }) };
      }
      // The view re-reads the case after acting; the server now reports the assignment.
      return { body: taken ? { ...detail, assignedAgentId: "staff-ana", status: "in_progress" } : detail };
    });
    const onChanged = vi.fn();
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole("button", { name: "Assumir caso" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(requests.some((r) => r.method === "POST" && r.url === `/api/staff/cases/${detail.id}/take`)).toBe(true);
    expect(screen.getByText("staff-ana")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Assumir caso" })).toBeNull();
  });

  test("a public reply is posted and then shown in the conversation", async () => {
    let replied = false;
    mockFetch((request) => {
      if (request.method === "POST") {
        replied = true;
        const body = request.body as { body: string };
        return { status: 201, body: message({ id: "m3", authorType: "staff", authorId: "staff-ana", authorName: "Ana Ribeiro", body: body.body }) };
      }
      return {
        body: replied
          ? { ...detail, messages: [...detail.messages, message({ id: "m3", authorType: "staff", authorId: "staff-ana", authorName: "Ana Ribeiro", body: "Olá, Alice!" })] }
          : detail,
      };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);

    fireEvent.change(screen.getByLabelText("Resposta ao cliente"), { target: { value: "Olá, Alice!" } });
    fireEvent.click(screen.getByRole("button", { name: "Responder ao cliente" }));

    expect(await screen.findByText("Olá, Alice!")).toBeDefined();
    expect(screen.getByText("Ana Ribeiro (você)")).toBeDefined();
  });
});
