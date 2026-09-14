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
  consultations: [],
};

const orbitAvailable = {
  customer: {
    state: "available",
    source: "simulated",
    fetchedAt: new Date().toISOString(),
    data: {
      userId: "cust-test",
      username: "alice.souza",
      accountStatus: "active",
      language: "pt-BR",
      country: "BR",
      registeredAt: "2025-11-03T14:12:00.000Z",
      emailMasked: "a***@e***.com",
      phoneMasked: "+55 ••• ••• 1234",
      verificationStatus: "verified",
      verificationNextAction: null,
      environment: "real",
    },
  },
};
const orbitUnavailable = { customer: { state: "unavailable", source: "simulated", fetchedAt: new Date().toISOString(), reason: "unavailable" } };

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
  test("shows the conversation with internal notes visibly marked and the Orbit summary, masked and labeled (PH-4.1)", async () => {
    mockFetch((request) => (request.url.endsWith("/orbit") ? { body: orbitAvailable } : { body: detail }));
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);

    expect(await screen.findByText(/SUP-000001/)).toBeDefined();
    expect(screen.getByText("Meu saque não chegou")).toBeDefined();
    expect(screen.getByText(/Nota interna · visível só para a equipe/)).toBeDefined();
    expect(screen.getByText("Verificar com Finance antes de responder.")).toBeDefined();
    expect(screen.getByText("Caso aberto pelo cliente")).toBeDefined();
    const facts = await screen.findByTestId("orbit-customer");
    expect(facts.textContent).toContain("alice.souza");
    expect(facts.textContent).toContain("a***@e***.com");
    expect(facts.textContent).toContain("Verificada");
    expect(facts.textContent).toContain("Conta real");
    expect(facts.textContent).not.toContain("example.com");
    expect(screen.getByText(/ainda não estão integrados/)).toBeDefined();
  });

  test("shows the Orbit summary as unavailable with its reason and a retry, never as an assumed value (RULE-SUP-07)", async () => {
    let calls = 0;
    mockFetch((request) => {
      if (!request.url.endsWith("/orbit")) return { body: detail };
      calls += 1;
      return { body: calls === 1 ? orbitUnavailable : orbitAvailable };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    expect((await screen.findByText(/Dados do Orbit indisponíveis: Orbit sem resposta/)).textContent).toBeDefined();
    expect(screen.queryByTestId("orbit-customer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect((await screen.findByTestId("orbit-customer")).textContent).toContain("alice.souza");
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

  test("status actions and the resolution form call the lifecycle endpoints (PH-3.1)", async () => {
    let status: "in_progress" | "waiting_customer" | "resolved" = "in_progress";
    let reason: string | null = null;
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/status")) {
        status = (request.body as { status: "waiting_customer" }).status;
        return { body: summary({ status }) };
      }
      if (request.url.endsWith("/resolve")) {
        status = "resolved";
        reason = (request.body as { reason: string }).reason;
        return { body: summary({ status, resolutionReason: "answered" }) };
      }
      return { body: { ...detail, status, assignedAgentId: "staff-ana", resolutionReason: status === "resolved" ? "answered" : null } };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);

    fireEvent.click(screen.getByRole("button", { name: "Aguardar cliente" }));
    await waitFor(() => expect(requests.some((r) => r.url === `/api/staff/cases/${detail.id}/status`)).toBe(true));
    expect(await screen.findByText("Aguardando cliente")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Resolver caso" }));
    const form = await screen.findByRole("form", { name: "Resolver caso" });
    expect(form).toBeDefined();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "answered" } });
    fireEvent.change(screen.getByLabelText("Explicação para o cliente"), { target: { value: "A operação liquidou às 10:31." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar resolução" }));

    await waitFor(() => expect(reason).toBe("answered"));
    const resolvePost = requests.find((r) => r.url.endsWith("/resolve"));
    expect(resolvePost?.body).toEqual({ reason: "answered", explanation: "A operação liquidou às 10:31." });
    expect(await screen.findByText("Resolvido · Dúvida respondida")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Resolver caso" })).toBeNull();
  });

  test("internal notes and consultations use their own endpoints and show the pending consultation (PH-3.2)", async () => {
    let consultations: Array<Record<string, unknown>> = [];
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/notes")) return { status: 201, body: message({ id: "n1", visibility: "internal", body: (request.body as { body: string }).body }) };
      if (request.url.endsWith("/consultations")) {
        const body = request.body as { team: string; question: string };
        consultations = [
          {
            id: "c1",
            caseId: detail.id,
            team: body.team,
            question: body.question,
            status: "open",
            requestedById: "staff-ana",
            requestedByName: "Ana Ribeiro",
            requestedAt: new Date().toISOString(),
            answeredById: null,
            answeredByName: null,
            answeredAt: null,
            answer: null,
          },
        ];
        return { status: 201, body: consultations[0] };
      }
      if (request.url.endsWith("/answer")) {
        consultations = [{ ...consultations[0], status: "answered", answer: (request.body as { answer: string }).answer, answeredByName: "Ana Ribeiro", answeredAt: new Date().toISOString() }];
        return { body: consultations[0] };
      }
      return { body: { ...detail, consultations, status: consultations.some((c) => c.status === "open") ? "waiting_internal" : "in_progress" } };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);

    fireEvent.click(screen.getByLabelText("Nota interna"));
    fireEvent.change(screen.getByLabelText("Nota interna (só a equipe vê)"), { target: { value: "Checar com Finance." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(requests.some((r) => r.url === `/api/staff/cases/${detail.id}/notes`)).toBe(true));
    expect(requests.find((r) => r.url.endsWith("/notes"))?.body).toEqual({ body: "Checar com Finance." });

    fireEvent.click(screen.getByRole("button", { name: "Consultar equipe" }));
    fireEvent.change(screen.getByLabelText("Equipe"), { target: { value: "security" } });
    fireEvent.change(screen.getByLabelText("Pergunta para a equipe"), { target: { value: "Há alerta na conta?" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar consulta" }));
    await waitFor(() => expect(requests.find((r) => r.url.endsWith("/consultations"))?.body).toEqual({ team: "security", question: "Há alerta na conta?" }));
    expect(await screen.findByText("1 consulta pendente")).toBeDefined();
    expect(screen.getByText("Aguardando equipe interna")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Resposta da equipe"), { target: { value: "Sem alertas." } });
    fireEvent.click(screen.getByRole("button", { name: "Responder consulta" }));
    await waitFor(() => expect(requests.some((r) => r.url.endsWith("/answer"))).toBe(true));
    expect(await screen.findByText("Sem alertas.")).toBeDefined();
    await waitFor(() => expect(screen.queryByText("1 consulta pendente")).toBeNull());
  });

  test("transfer, release and attribute edits call their endpoints and surface a forbidden transfer (PH-3.3)", async () => {
    let assigned: string | null = "staff-ana";
    let priority = "normal";
    let forbidOnce = true;
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/assign")) {
        if (forbidOnce) {
          forbidOnce = false;
          return { status: 403, body: { message: "not_case_owner" } };
        }
        assigned = (request.body as { agentId: string | null }).agentId;
        return { body: summary({ assignedAgentId: assigned }) };
      }
      if (request.method === "PATCH") {
        priority = (request.body as { priority: string }).priority;
        return { body: summary({ priority: priority as "high" }) };
      }
      return { body: { ...detail, assignedAgentId: assigned, priority } };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);

    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    fireEvent.change(screen.getByLabelText("Transferir para"), { target: { value: "staff-bruno" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar transferência" }));
    expect(await screen.findByText("Só o responsável ou um supervisor pode transferir este caso.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar transferência" }));
    await waitFor(() => expect(assigned).toBe("staff-bruno"));
    expect(requests.filter((r) => r.url.endsWith("/assign"))).toHaveLength(2);
    expect(await screen.findByText("staff-bruno")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Prioridade"), { target: { value: "high" } });
    await waitFor(() => expect(priority).toBe("high"));
    const patch = requests.find((r) => r.method === "PATCH");
    expect(patch?.url).toBe(`/api/staff/cases/${detail.id}`);
    expect(patch?.body).toEqual({ priority: "high" });
  });

  test("a resolved case offers 'Encerrar caso' which posts to /close and shows the closure (PH-3.4)", async () => {
    let status: "resolved" | "closed" = "resolved";
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/close")) {
        status = "closed";
        return { body: summary({ status }) };
      }
      return { body: { ...detail, status, resolutionReason: "solved", assignedAgentId: "staff-ana" } };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    fireEvent.click(await screen.findByRole("button", { name: "Encerrar caso" }));
    await waitFor(() => expect(requests.some((r) => r.url === `/api/staff/cases/${detail.id}/close`)).toBe(true));
    expect(await screen.findByText("Encerrado")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Encerrar caso" })).toBeNull();
    expect(screen.queryByLabelText("Resposta ao cliente")).toBeNull();
  });

  test("shared incidents: create-and-link, broadcast a note to linked cases, resolve without touching the case (PH-3.5)", async () => {
    let incident: Record<string, unknown> | null = null;
    let linkedId: string | null = null;
    const { requests } = mockFetch((request) => {
      if (request.url === "/api/staff/incidents" && request.method === "GET") return { body: incident ? [incident] : [] };
      if (request.url === "/api/staff/incidents" && request.method === "POST") {
        incident = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: (request.body as { title: string }).title, description: null, status: "open", createdById: "staff-ana", createdByName: "Ana Ribeiro", createdAt: new Date().toISOString(), resolvedAt: null, resolvedById: null, linkedCaseCount: 1 };
        return { status: 201, body: incident };
      }
      if (request.url.endsWith("/incident")) {
        linkedId = (request.body as { incidentId: string | null }).incidentId;
        return { body: summary({ incidentId: linkedId, incidentTitle: linkedId ? "Atraso Pix" : null }) };
      }
      if (request.url.endsWith("/notes") && request.url.includes("/incidents/")) return { body: { delivered: 2 } };
      if (request.url.endsWith("/resolve") && request.url.includes("/incidents/")) {
        incident = { ...incident!, status: "resolved" };
        return { body: incident };
      }
      return { body: { ...detail, incidentId: linkedId, incidentTitle: linkedId ? "Atraso Pix" : null } };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);

    fireEvent.click(screen.getByRole("button", { name: "Criar incidente" }));
    fireEvent.change(screen.getByLabelText("Título do incidente"), { target: { value: "Atraso Pix" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar e vincular" }));
    await waitFor(() => expect(linkedId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    expect(requests.find((r) => r.url === "/api/staff/incidents" && r.method === "POST")?.body).toEqual({ title: "Atraso Pix" });
    expect(await screen.findByText("Atraso Pix")).toBeDefined();

    fireEvent.change(await screen.findByLabelText("Nota interna para todos os casos vinculados"), { target: { value: "Provedor normalizado." } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar nota a todos" }));
    expect(await screen.findByText("Nota enviada a 2 caso(s) vinculado(s).")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Marcar incidente como resolvido" }));
    await waitFor(() => expect(requests.some((r) => r.url.endsWith("/resolve") && r.url.includes("/incidents/"))).toBe(true));
    expect(screen.getByText("Novo")).toBeDefined(); // the case status did not change
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

  test("PH-4.2: staff see the record card with the snapshot facts and the record's current state from Orbit", async () => {
    const snapshot = { kind: "withdrawal", reference: "WD-48213", title: "Saque 250 USDT", status: "Em processamento", occurredAt: new Date().toISOString(), amount: "250.00", currency: "USDT", facts: [{ label: "Destino", value: "TX7f…9k2Q" }] };
    mockFetch((request) =>
      request.url.endsWith("/orbit")
        ? { body: { ...orbitAvailable, record: { state: "available", source: "simulated", fetchedAt: new Date().toISOString(), data: { ...snapshot, status: "Concluído" } } } }
        : { body: { ...detail, record: { kind: "withdrawal", reference: "WD-48213", capturedAt: new Date().toISOString(), snapshot, lookupReason: null } } },
    );
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    const card = await screen.findByTestId("staff-case-record");
    expect(card.textContent).toContain("Em processamento");
    expect(card.textContent).toContain("TX7f…9k2Q");
    const current = await screen.findByTestId("orbit-record-current");
    expect(current.textContent).toContain("Concluído");
  });

});
