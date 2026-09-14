import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError, type AttachmentClient } from "@/lib/api";
import { AttachmentComposer } from "./AttachmentComposer";
import { AttachmentList } from "./AttachmentList";
import { attachment } from "./test-utils";

afterEach(() => vi.restoreAllMocks());

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function fakeClient(overrides: Partial<AttachmentClient> = {}): AttachmentClient {
  return {
    upload: vi.fn(async (file: File) => attachment({ fileName: file.name, sizeBytes: file.size, messageId: null })),
    fetchBlob: vi.fn(async () => new Blob([PNG_BYTES], { type: "image/png" })),
    ...overrides,
  };
}

describe("AttachmentComposer", () => {
  test("uploads a picked file, reports its id as ready and lets the user remove it", async () => {
    const client = fakeClient();
    const onReadyChange = vi.fn();
    render(<AttachmentComposer client={client} onReadyChange={onReadyChange} clearToken={0} />);

    const file = new File([PNG_BYTES], "comprovante.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Anexar arquivo"), { target: { files: [file] } });

    expect(await screen.findByText("comprovante.png")).toBeDefined();
    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith([attachment().id]));
    expect(client.upload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Remover comprovante.png" }));
    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith([]));
  });

  test("refuses oversized and unsupported files before uploading, and shows server refusals honestly", async () => {
    const client = fakeClient({
      upload: vi.fn(async () => {
        throw new ApiError(415, { error: "unsupported_file_type" });
      }),
    });
    render(<AttachmentComposer client={client} onReadyChange={() => {}} clearToken={0} />);

    const big = new File([new Uint8Array(11 * 1024 * 1024)], "grande.png", { type: "image/png" });
    const exe = new File([new Uint8Array([0x4d, 0x5a])], "app.exe", { type: "application/x-msdownload" });
    const disguised = new File([new Uint8Array([0x4d, 0x5a])], "foto.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Anexar arquivo"), { target: { files: [big, exe, disguised] } });

    expect(await screen.findByText("Arquivo maior que 10 MB.")).toBeDefined();
    expect(await screen.findAllByText("Tipo não permitido. Envie PNG, JPEG, WebP ou PDF.")).toHaveLength(2);
    expect(client.upload).toHaveBeenCalledTimes(1); // only the disguised file reached the server
  });

  test("enforces the per-message maximum", async () => {
    const client = fakeClient();
    render(<AttachmentComposer client={client} onReadyChange={() => {}} clearToken={0} />);
    const files = [1, 2, 3, 4].map((n) => new File([PNG_BYTES], `f${n}.png`, { type: "image/png" }));
    fireEvent.change(screen.getByLabelText("Anexar arquivo"), { target: { files } });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Máximo de 3 arquivos por mensagem.");
    await waitFor(() => expect(client.upload).toHaveBeenCalledTimes(3));
  });
});

describe("AttachmentList", () => {
  test("renders images as thumbnails fetched with identity and PDFs as file chips with an open action", async () => {
    const client = fakeClient();
    render(
      <AttachmentList
        client={client}
        attachments={[attachment(), attachment({ id: "44444444-4444-4444-8444-444444444444", fileName: "orientações.pdf", mimeType: "application/pdf", sizeBytes: 120_000 })]}
      />,
    );
    const img = await screen.findByAltText("Imagem anexada: comprovante.png");
    expect(img.getAttribute("src")).toMatch(/^blob:/);
    expect(client.fetchBlob).toHaveBeenCalledWith(attachment().id, expect.anything());
    expect(screen.getByText("orientações.pdf")).toBeDefined();
    expect(screen.getByRole("button", { name: "Abrir" })).toBeDefined();
    expect(screen.getByText(/117 KB/)).toBeDefined();
  });

  test("shows an unavailable state instead of a broken image when the file cannot be fetched", async () => {
    const client = fakeClient({
      fetchBlob: vi.fn(async () => {
        throw new ApiError(404, null);
      }),
    });
    render(<AttachmentList client={client} attachments={[attachment()]} />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Arquivo indisponível"));
  });
});
