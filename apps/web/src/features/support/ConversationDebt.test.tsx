import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { dictionary as t } from "@/i18n";
import { CaseConversation } from "./CaseConversation";
import { attachment, identity, message, mockFetch, summary } from "./test-utils";

vi.mock("@/lib/sse", () => ({ subscribeStream: () => () => {} }));

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const detail = { ...summary({ status: "in_progress", assignedAgentId: "staff-ana" }), messages: [message({ id: "m1" })] };

describe("PH-9.2 customer conversation debt", () => {
  test("a message that failed to send shows the files it carries, and the retry sends the same message with them (BL-013)", async () => {
    let fail = true;
    const { requests } = mockFetch((request) => {
      if (request.url.endsWith("/attachments") && request.method === "POST") return { status: 201, body: attachment({ messageId: null }) };
      if (request.url.endsWith("/messages") && request.method === "POST") {
        if (fail) return { status: 503, body: { error: "unavailable" } };
        return { status: 201, body: message({ id: "m9", body: "Segue o comprovante", attachments: [attachment()] }) };
      }
      return { body: detail };
    });
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    await screen.findByText(/SUP-000001/);
    fireEvent.change(screen.getByLabelText(t.attachments.attach), { target: { files: [new File([PNG_BYTES], "comprovante.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("comprovante.png").closest("li")?.getAttribute("data-state")).toBe("ready"));
    fireEvent.change(screen.getByLabelText(t.support.conversation.composerLabel), { target: { value: "Segue o comprovante" } });
    fireEvent.click(screen.getByRole("button", { name: t.support.conversation.send }));

    expect(await screen.findByText(t.support.conversation.failed)).toBeDefined();
    expect(screen.getByTestId("pending-attachments").textContent).toBe("Anexos: comprovante.png");
    expect(screen.queryByText("comprovante.png")).toBeNull(); // the chips moved onto the pending row

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: t.support.conversation.retry }));
    await waitFor(() => expect(requests.filter((r) => r.url.endsWith("/messages") && r.method === "POST")).toHaveLength(2));
    const [first, second] = requests.filter((r) => r.url.endsWith("/messages") && r.method === "POST").map((r) => r.body);
    expect(second).toEqual(first);
    expect(first).toMatchObject({ body: "Segue o comprovante", attachmentIds: [attachment().id] });
    await waitFor(() => expect(screen.queryByTestId("pending-attachments")).toBeNull());
  });

  test("system messages are worded from their kind; a notice without one keeps its stored text (BL-024)", async () => {
    mockFetch(() => ({
      body: {
        ...detail,
        messages: [
          message({ id: "s1", authorType: "system", authorId: "system", body: "TEXTO ANTIGO", systemKind: "outside_hours", systemData: {} }),
          message({ id: "s2", authorType: "system", authorId: "system", body: "Aviso gravado antes da migração." }),
        ],
      },
    }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    expect(await screen.findByText(t.systemMessages.outsideHours)).toBeDefined();
    expect(screen.queryByText("TEXTO ANTIGO")).toBeNull();
    expect(screen.getByText("Aviso gravado antes da migração.")).toBeDefined();
  });

  test("Cycle Audit 3 FND-0092: a notice whose value is missing keeps its stored text", async () => {
    mockFetch(() => ({ body: { ...detail, messages: [message({ id: "s9", authorType: "system", authorId: "system", body: "Continuação do caso anterior.", systemKind: "follow_up_of", systemData: {} })] } }));
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    expect(await screen.findByText("Continuação do caso anterior.")).toBeDefined();
    expect(screen.queryByText("Continuação do caso .")).toBeNull();
  });

  test("Cycle Audit 3 FND-0088: the customer cannot send while a file is still uploading", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => (finish = resolve));
    mockFetch(async (request) => {
      if (request.url.endsWith("/attachments") && request.method === "POST") {
        await pending;
        return { status: 201, body: attachment({ messageId: null }) };
      }
      return { body: detail };
    });
    render(<CaseConversation identity={identity} caseId={detail.id} />);
    await screen.findByText(/SUP-000001/);
    fireEvent.change(screen.getByLabelText(t.support.conversation.composerLabel), { target: { value: "Segue" } });
    fireEvent.change(screen.getByLabelText(t.attachments.attach), { target: { files: [new File([PNG_BYTES], "comprovante.png", { type: "image/png" })] } });
    const send = screen.getByRole<HTMLButtonElement>("button", { name: t.support.conversation.send });
    await waitFor(() => expect(screen.getByText("comprovante.png").closest("li")?.getAttribute("data-state")).toBe("uploading"));
    expect(send.disabled).toBe(true);
    finish();
    await waitFor(() => expect(send.disabled).toBe(false));
  });
});
