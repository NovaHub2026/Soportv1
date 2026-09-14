import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { message, mockFetch, summary } from "@/features/support/test-utils";
import type { StaffIdentity } from "@/lib/staff-api";
import { StaffCaseView } from "./StaffCaseView";
import { StaffQueue } from "./StaffQueue";
import { AccessRecoveryPanel } from "./AccessRecoveryPanel";
import { SupervisionPanel } from "./SupervisionPanel";

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
    expect(requests[0].url).toBe("/api/staff/cases?view=unassigned&limit=50&offset=0");
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

  test("PH-5.1: offers every lifecycle view, flags unanswered customer messages with their age, and loads more", async () => {
    const since = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const { requests } = mockFetch(() => ({ body: [summary({ awaitingReplySince: since, subject: "Sem resposta" }), summary({ id: "x", subject: "Ok" })] }));
    const onViewChange = vi.fn();
    render(<StaffQueue identity={ana} view="active" onViewChange={onViewChange} selectedCaseId={null} onSelectCase={() => {}} refreshToken={0} />);
    expect(await screen.findByText("Sem resposta")).toBeDefined();
    expect(screen.getByTestId("awaiting-reply").textContent).toBe("Sem resposta há 3 h");
    for (const name of ["Aguardando cliente", "Aguardando equipe", "Resolvidos", "Encerrados"]) expect(screen.getByRole("tab", { name })).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Resolvidos" }));
    expect(onViewChange).toHaveBeenCalledWith("resolved");
    expect(requests[0].url).toBe("/api/staff/cases?view=active&limit=50&offset=0");
  });

  test("FND-0036: 'Carregar mais' stops at the API page limit and a failed refresh flags the list instead of freezing it silently", async () => {
    let fail = false;
    const { requests } = mockFetch((request) => {
      if (fail) return { status: 500, body: { error: "boom" } };
      const limit = Number(new URL(request.url, "http://x").searchParams.get("limit"));
      return { body: Array.from({ length: limit }, (_, i) => summary({ id: `case-${i}`, reference: `SUP-${String(i + 1).padStart(6, "0")}`, subject: `Caso ${i}` })) };
    });
    const { rerender } = render(<StaffQueue identity={ana} view="active" onViewChange={() => {}} selectedCaseId={null} onSelectCase={() => {}} refreshToken={0} />);
    await screen.findByText("Caso 0");
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));
      await waitFor(() => expect(requests.at(-1)?.url).toContain(`limit=${50 * (i + 2)}`));
      await screen.findByText(`Caso ${50 * (i + 2) - 1}`);
    }
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
    expect(screen.getByRole("note").textContent).toContain("200");
    expect(requests.every((r) => Number(new URL(r.url, "http://x").searchParams.get("limit")) <= 200)).toBe(true);

    fail = true;
    rerender(<StaffQueue identity={ana} view="active" onViewChange={() => {}} selectedCaseId={null} onSelectCase={() => {}} refreshToken={1} />);
    expect(await screen.findByText("A lista pode estar desatualizada: a última atualização falhou.")).toBeDefined();
    expect(screen.getByText("Caso 0")).toBeDefined(); // the last good list stays visible
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.queryByText("A lista pode estar desatualizada: a última atualização falhou.")).toBeNull());
  });

  test("PH-5.2: typing a search term and picking filters sends them with the list request", async () => {
    const { requests } = mockFetch(() => ({ body: [] }));
    render(<StaffQueue identity={ana} view="active" onViewChange={() => {}} selectedCaseId={null} onSelectCase={() => {}} refreshToken={0} />);
    await screen.findByText("Nenhum caso ativo no momento.");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar casos" }), { target: { value: "WD-48213" } });
    fireEvent.change(screen.getByLabelText("Filtrar por prioridade"), { target: { value: "high" } });
    await waitFor(() => expect(requests.at(-1)?.url).toContain("q=WD-48213"));
    expect(requests.at(-1)?.url).toContain("priority=high");
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    await waitFor(() => expect(requests.at(-1)?.url).toBe("/api/staff/cases?view=active&limit=50&offset=0"));
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
    const notIntegrated = screen.getByTestId("orbit-not-integrated");
    expect(notIntegrated.textContent).toContain("Saldos e movimentos");
    expect(notIntegrated.textContent).toContain("integração ainda não construída");
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

  test("PH-7.2: an agent viewing a colleague's case sees the state actions disabled with the reason, while replying stays possible; a supervisor sees them enabled", async () => {
    mockFetch(() => ({ body: { ...detail, assignedAgentId: "staff-bruno", status: "in_progress" } }));
    const { unmount } = render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    expect(screen.getByTestId("not-owner-hint").textContent).toContain("Só o responsável ou um supervisor");
    for (const name of ["Aguardar cliente", "Aguardar equipe interna", "Consultar equipe", "Transferir", "Devolver à fila", "Resolver caso"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByLabelText("Resposta ao cliente")).toBeDefined();
    unmount();

    const carla = { staffId: "staff-carla", displayName: "Carla Nunes", role: "supervisor" as const };
    render(<StaffCaseView identity={carla} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    expect(screen.queryByTestId("not-owner-hint")).toBeNull();
    expect((screen.getByRole("button", { name: "Resolver caso" }) as HTMLButtonElement).disabled).toBe(false);
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


  test("PH-5.3: a saved reply can be inserted into the reply draft without sending", async () => {
    const reply = { id: "r1", title: "Saque em análise", body: "Seu saque está em análise.", category: null, createdById: "staff-ana", createdByName: "Ana", updatedById: "staff-ana", updatedByName: "Ana", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/saved-replies")) return { body: [reply] };
      if (request.url.endsWith("/orbit")) return { body: orbitAvailable };
      return { body: { ...detail, assignedAgentId: "staff-ana", status: "in_progress" } };
    });
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    const picker = await screen.findByLabelText("Inserir resposta salva");
    fireEvent.change(picker, { target: { value: "r1" } });
    expect((screen.getByLabelText("Resposta ao cliente") as HTMLTextAreaElement).value).toBe("Seu saque está em análise.");
    expect(requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages"))).toHaveLength(0);
  });


  test("PH-5.4: the supervision panel shows demand, overdue cases with reassignment, metrics without targets and the settings form", async () => {
    const overdue = summary({ id: "od", reference: "SUP-000009", subject: "Atrasado", awaitingReplySince: new Date(Date.now() - 6 * 3_600_000).toISOString() });
    const { requests } = mockFetch((request) => {
      if (request.url === "/api/staff/overview") return { body: { byStatus: { new: 1, in_progress: 2, waiting_customer: 0, waiting_internal: 0, resolved: 0, closed: 0 }, unassigned: { count: 1, oldestCreatedAt: new Date(Date.now() - 3_600_000).toISOString() }, awaitingReply: { count: 2, oldestSince: overdue.awaitingReplySince }, byAgent: [{ agentId: "staff-ana", open: 2, awaitingReply: 1 }], attentionThresholdHours: 4, overdue: [overdue], computedAt: "" } };
      if (request.url.startsWith("/api/staff/metrics")) return { body: { periodDays: 7, from: "", to: "", created: 3, resolved: 1, closed: 0, reopened: 1, firstResponse: { count: 2, medianMinutes: 12, p90Minutes: 30 }, resolution: { count: 1, medianMinutes: 240, p90Minutes: 240 }, unansweredNow: { count: 2, oldestMinutes: 360 }, reopenRate: 1, targets: null } };
      if (request.url === "/api/staff/settings") return { body: { timezone: "America/Sao_Paulo", schedule: { mon: { open: "09:00", close: "18:00" }, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }, attentionThresholdHours: 4, followUpWindowDays: 7, emailDelayMinutes: 15, reminderAfterHours: 48, workingDefault: true, updatedById: null, updatedByName: null, updatedAt: null } };
      if (request.url.endsWith("/assign")) return { body: summary({ id: "od", assignedAgentId: "staff-bruno" }) };
      return { body: [] };
    });
    const carla: StaffIdentity = { staffId: "staff-carla", displayName: "Carla Nunes", role: "supervisor" };
    const onOpenCase = vi.fn();
    render(<SupervisionPanel identity={carla} onClose={() => {}} onOpenCase={onOpenCase} />);
    expect((await screen.findByTestId("overview")).textContent).toContain("Aguardando resposta humana2");
    expect(screen.getByTestId("by-agent").textContent).toContain("Ana Ribeiro");
    expect(screen.getByTestId("metrics").textContent).toContain("mediana 12 min · p90 30 min · n=2");
    expect(screen.getByText(/Não há metas definidas/)).toBeDefined();
    expect(screen.getByText(/ainda não os configurou/)).toBeDefined();
    fireEvent.change(screen.getByLabelText("Reatribuir a"), { target: { value: "staff-bruno" } });
    await waitFor(() => expect(requests.some((r) => r.url.endsWith("/od/assign") && (r.body as { agentId: string }).agentId === "staff-bruno")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /SUP-000009/ }));
    expect(onOpenCase).toHaveBeenCalledWith("od");
  });

  test("PH-7.1: the recovery page lists unverified contacts and records an attributable outcome", async () => {
    const received = { id: "33333333-3333-4333-8333-333333333333", reference: "REC-000001", contact: "alice@example.com", description: "O código nunca chega.", status: "received", createdAt: new Date().toISOString(), handledById: null, handledByName: null, handledAt: null, note: null };
    let handled = false;
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/handle")) {
        handled = true;
        return { body: { ...received, status: "forwarded", handledById: "staff-ana", handledByName: "Ana Ribeiro", handledAt: new Date().toISOString(), note: request.body && typeof request.body === "object" ? (request.body as { note?: string }).note ?? null : null } };
      }
      return { body: handled ? [] : [received] };
    });
    render(<AccessRecoveryPanel identity={ana} onClose={() => {}} />);
    expect((await screen.findByTestId("recovery-request")).textContent).toContain("REC-000001");
    expect(screen.getByText(/alice@example.com/)).toBeDefined();
    fireEvent.change(screen.getByLabelText("Observação (opcional)"), { target: { value: "Retornei por e-mail." } });
    fireEvent.click(screen.getByRole("button", { name: "Encaminhar ao processo de verificação" }));
    expect((await screen.findByRole("status")).textContent).toContain("REC-000001 encaminhado");
    const call = requests.find((r) => r.url.endsWith("/handle"))!;
    expect(call.body).toEqual({ outcome: "forwarded", note: "Retornei por e-mail." });
    await waitFor(() => expect(screen.queryByTestId("recovery-request")).toBeNull());
    expect(screen.getByText("Nenhum pedido neste filtro.")).toBeDefined();
  });
});
