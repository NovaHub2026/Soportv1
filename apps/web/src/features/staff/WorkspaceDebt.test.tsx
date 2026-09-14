import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StaffQueueView } from "@orbit-support/shared";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { message, mockFetch, type RecordedRequest, summary } from "@/features/support/test-utils";
import { dictionary as t } from "@/i18n";
import type { StaffIdentity } from "@/lib/staff-api";
import { StaffCaseView } from "./StaffCaseView";
import { StaffQueue } from "./StaffQueue";
import { StaffWorkspace } from "./StaffWorkspace";
import { SupervisionPanel } from "./SupervisionPanel";

vi.mock("@/lib/sse", () => ({ subscribeStream: () => () => {} }));

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  Reflect.deleteProperty(document, "visibilityState"); // back to jsdom's own getter
});

const ana: StaffIdentity = { staffId: "staff-ana", displayName: "Ana Ribeiro", role: "agent" };
const carla: StaffIdentity = { staffId: "staff-carla", displayName: "Carla Nunes", role: "supervisor" };
const orbitUnavailable = { customer: { state: "unavailable", source: "simulated", fetchedAt: new Date().toISOString(), reason: "unavailable" } };
const detail = {
  ...summary({ status: "in_progress", assignedAgentId: "staff-ana" }),
  messages: [message({ id: "m1", body: "Meu saque não chegou" })],
  events: [],
  consultations: [],
  record: null,
};

/** A responder for everything a case view reads; `extra` answers the requests a test is about. */
function caseResponder(extra: (request: RecordedRequest) => { status?: number; body?: unknown } | undefined = () => undefined) {
  return (request: RecordedRequest) => {
    const answer = extra(request);
    if (answer) return answer;
    if (request.url.endsWith("/orbit")) return { body: orbitUnavailable };
    if (request.url.includes("/saved-replies") || request.url.includes("/incidents")) return { body: [] };
    return { body: detail };
  };
}

const setVisibility = (state: "visible" | "hidden") => Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });

describe("PH-9.2 staff workspace debt", () => {
  test("a failed note keeps its text and is retried with the same key; the next note gets a new key (BL-013)", async () => {
    let fail = true;
    const { requests } = mockFetch(
      caseResponder((request) => {
        if (!request.url.endsWith("/notes")) return undefined;
        if (fail) {
          fail = false;
          return { status: 503, body: { error: "unavailable" } };
        }
        return { status: 201, body: message({ id: "n1", visibility: "internal", authorType: "staff", authorId: "staff-ana" }) };
      }),
    );
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    fireEvent.click(screen.getByLabelText("Nota interna"));
    const box = screen.getByLabelText("Nota interna (só a equipe vê)") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "Checar extrato." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect(await screen.findByText(t.staff.notes.failed)).toBeDefined();
    expect(box.value).toBe("Checar extrato.");

    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(box.value).toBe(""));
    fireEvent.change(box, { target: { value: "Outra nota." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(requests.filter((r) => r.url.endsWith("/notes"))).toHaveLength(3));
    const keys = requests.filter((r) => r.url.endsWith("/notes")).map((r) => (r.body as { clientMessageId: string }).clientMessageId);
    expect(keys[1]).toBe(keys[0]); // the retry
    expect(keys[2]).not.toBe(keys[0]); // a new note
  });

  test("system messages are worded from their kind; a notice without one keeps its stored text (BL-024)", async () => {
    const withNotices = {
      ...detail,
      messages: [
        message({ id: "s1", authorType: "system", authorId: "system", body: "TEXTO ANTIGO", systemKind: "outside_hours", systemData: { weekday: "mon", open: "09:00" } }),
        message({ id: "s2", authorType: "system", authorId: "system", body: "Aviso gravado antes da migração." }),
        message({ id: "s3", authorType: "system", authorId: "system", body: "x", systemKind: "follow_up_of", systemData: { reference: "SUP-000007" } }),
      ],
    };
    mockFetch(caseResponder((request) => (request.url.endsWith(detail.id) ? { body: withNotices } : undefined)));
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    expect(await screen.findByText(`${t.systemMessages.outsideHours} Próximo atendimento: segunda às 09:00.`)).toBeDefined();
    expect(screen.queryByText("TEXTO ANTIGO")).toBeNull();
    expect(screen.getByText("Aviso gravado antes da migração.")).toBeDefined();
    expect(screen.getByText("Continuação do caso SUP-000007.")).toBeDefined();
  });

  test("a hidden browser tab marks nothing read; the next read while visible does (BL-014)", async () => {
    setVisibility("hidden");
    const { requests } = mockFetch(
      caseResponder((request) => {
        if (request.url.endsWith("/read")) return { body: summary() };
        if (request.url.endsWith(detail.id)) return { body: { ...detail, unreadCount: 2 } };
        return undefined;
      }),
    );
    const { rerender } = render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests.some((r) => r.url.endsWith("/read"))).toBe(false);
    setVisibility("visible");
    rerender(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} signal={{ caseId: detail.id, seq: 1 }} />);
    await waitFor(() => expect(requests.some((r) => r.method === "POST" && r.url.endsWith("/read"))).toBe(true));
  });

  test("the queue tabs are real tabs: one tab stop, arrows/Home/End change the view and move focus, the list is the tab panel (BL-024)", async () => {
    function Harness() {
      const [view, setView] = useState<StaffQueueView>("unassigned");
      return <StaffQueue identity={ana} view={view} onViewChange={setView} selectedCaseId={null} onSelectCase={() => {}} refreshToken={0} />;
    }
    mockFetch(() => ({ body: [] }));
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: t.staff.queuesLabel })).toBeDefined();
    let tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[0].id);

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    await waitFor(() => expect(screen.getAllByRole("tab")[1].getAttribute("aria-selected")).toBe("true"));
    tabs = screen.getAllByRole("tab");
    expect(document.activeElement).toBe(tabs[1]);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[1].id);
    fireEvent.keyDown(tabs[1], { key: "End" });
    await waitFor(() => expect(screen.getAllByRole("tab")[6].getAttribute("aria-selected")).toBe("true"));
    fireEvent.keyDown(screen.getAllByRole("tab")[6], { key: "ArrowRight" }); // wraps around
    await waitFor(() => expect(screen.getAllByRole("tab")[0].getAttribute("aria-selected")).toBe("true"));
    fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getAllByRole("tab")[6].getAttribute("aria-selected")).toBe("true"));
    fireEvent.keyDown(screen.getAllByRole("tab")[6], { key: "Home" });
    await waitFor(() => expect(screen.getAllByRole("tab")[0].getAttribute("aria-selected")).toBe("true"));
    expect(document.activeElement).toBe(screen.getAllByRole("tab")[0]);
  });

  test("settings number fields keep what was typed: an emptied field is refused by name and nothing is sent (BL-024)", async () => {
    const settings = { timezone: "America/Sao_Paulo", schedule: { mon: { open: "09:00", close: "18:00" }, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }, attentionThresholdHours: 4, followUpWindowDays: 7, emailDelayMinutes: 15, reminderAfterHours: 48, workingDefault: true, updatedById: null, updatedByName: null, updatedAt: null };
    const { requests } = mockFetch((request) => {
      if (request.url === "/api/staff/settings" && request.method === "PUT") return { body: { ...settings, ...(request.body as object), workingDefault: false, updatedById: "staff-carla", updatedByName: "Carla Nunes", updatedAt: new Date().toISOString() } };
      if (request.url === "/api/staff/settings") return { body: settings };
      if (request.url === "/api/staff/overview") return { body: { byStatus: { new: 0, in_progress: 0, waiting_customer: 0, waiting_internal: 0, resolved: 0, closed: 0 }, unassigned: { count: 0, oldestCreatedAt: null }, awaitingReply: { count: 0, oldestSince: null }, waitingInternal: { count: 0, oldestSince: null }, byAgent: [], attentionThresholdHours: 4, overdue: [], computedAt: "" } };
      if (request.url.startsWith("/api/staff/metrics")) return { body: { periodDays: 7, from: "", to: "", created: 0, resolved: 0, closed: 0, reopened: 0, firstResponse: { count: 0, medianMinutes: null, p90Minutes: null }, resolution: { count: 0, medianMinutes: null, p90Minutes: null }, unansweredNow: { count: 0, oldestMinutes: null }, reopenRate: null, targets: null } };
      return { body: [] };
    });
    render(<SupervisionPanel identity={carla} onClose={() => {}} onOpenCase={() => {}} />);
    const threshold = (await screen.findByLabelText(t.staff.supervision.threshold)) as HTMLInputElement;
    fireEvent.change(threshold, { target: { value: "" } });
    expect(threshold.value).toBe(""); // not 0
    fireEvent.click(screen.getByRole("button", { name: t.staff.supervision.saveSettings }));
    expect(await screen.findByText(`Configuração inválida (${t.staff.supervision.threshold}). Nada foi salvo.`)).toBeDefined();
    expect(requests.some((r) => r.method === "PUT")).toBe(false);

    fireEvent.change(threshold, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: t.staff.supervision.saveSettings }));
    await waitFor(() => expect(requests.find((r) => r.method === "PUT")?.body).toMatchObject({ attentionThresholdHours: 12, followUpWindowDays: 7, emailDelayMinutes: 15, reminderAfterHours: 48 }));
    expect(await screen.findByText(t.staff.supervision.settingsSaved)).toBeDefined();
    expect(threshold.value).toBe("12");
  });

  test("the workspace picker switches the simulated agent: requests carry the new identity and supervision follows the role (BL-014)", async () => {
    const { requests } = mockFetch(() => ({ body: [] }));
    render(<StaffWorkspace />);
    await screen.findByRole("tab", { name: t.staff.queues.unassigned });
    const picker = screen.getByRole("combobox", { name: t.staff.agentPicker });
    expect(screen.queryByRole("button", { name: t.staff.supervision.open })).toBeNull();
    fireEvent.change(picker, { target: { value: "staff-bruno" } });
    await waitFor(() => expect(requests.at(-1)?.headers["x-simulated-staff-id"]).toBe("staff-bruno"));
    expect(screen.queryByRole("button", { name: t.staff.supervision.open })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: t.staff.agentPicker }), { target: { value: "staff-carla" } });
    expect(await screen.findByRole("button", { name: t.staff.supervision.open })).toBeDefined();
    await waitFor(() => expect(requests.at(-1)?.headers["x-simulated-staff-id"]).toBe("staff-carla"));
  });

  test("Cycle Audit 3 FND-0087: an edited note after a failure is a new message with a new key; the same text keeps its key", async () => {
    let failures = 2;
    const { requests } = mockFetch(
      caseResponder((request) => {
        if (!request.url.endsWith("/notes")) return undefined;
        if (failures > 0) {
          failures -= 1;
          return { status: 503, body: { error: "unavailable" } };
        }
        return { status: 201, body: message({ id: "n2", visibility: "internal", authorType: "staff", authorId: "staff-ana" }) };
      }),
    );
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    fireEvent.click(screen.getByLabelText("Nota interna"));
    const box = screen.getByLabelText("Nota interna (só a equipe vê)") as HTMLTextAreaElement;
    const save = () => fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    const notes = () => requests.filter((r) => r.url.endsWith("/notes"));
    fireEvent.change(box, { target: { value: "Primeira versão." } });
    save();
    await waitFor(() => expect(notes()).toHaveLength(1));
    await screen.findByRole("button", { name: "Salvar nota" });
    fireEvent.change(box, { target: { value: "Versão corrigida." } });
    save();
    await waitFor(() => expect(notes()).toHaveLength(2));
    await screen.findByRole("button", { name: "Salvar nota" });
    save();
    await waitFor(() => expect(notes()).toHaveLength(3));
    const keys = notes().map((r) => (r.body as { clientMessageId: string }).clientMessageId);
    expect(keys[1]).not.toBe(keys[0]); // edited → a new message
    expect(keys[2]).toBe(keys[1]); // same text → the retry of that message
  });

  test("Cycle Audit 3 FND-0091: a failed reply's key never becomes a note's key", async () => {
    const { requests } = mockFetch(
      caseResponder((request) => {
        if (request.method === "POST" && request.url.endsWith("/messages")) return { status: 503, body: {} };
        if (request.url.endsWith("/notes")) return { status: 201, body: message({ id: "n3", visibility: "internal", authorType: "staff", authorId: "staff-ana" }) };
        return undefined;
      }),
    );
    render(<StaffCaseView identity={ana} caseId={detail.id} onChanged={() => {}} />);
    await screen.findByText(/SUP-000001/);
    fireEvent.change(screen.getByLabelText("Resposta ao cliente"), { target: { value: "Olá, estamos verificando." } });
    fireEvent.click(screen.getByRole("button", { name: "Responder ao cliente" }));
    await screen.findByText(t.staff.sendFailed);
    fireEvent.click(screen.getByLabelText("Nota interna"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(requests.some((r) => r.url.endsWith("/notes"))).toBe(true));
    const replyKey = (requests.find((r) => r.method === "POST" && r.url.endsWith("/messages"))?.body as { clientMessageId: string }).clientMessageId;
    const noteKey = (requests.find((r) => r.url.endsWith("/notes"))?.body as { clientMessageId: string }).clientMessageId;
    expect(noteKey).not.toBe(replyKey);
  });
});
