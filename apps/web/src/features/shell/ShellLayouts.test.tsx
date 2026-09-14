import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { mockFetch, type RecordedRequest } from "@/features/support/test-utils";
import { OrbitShell } from "./OrbitShell";

vi.mock("@/lib/sse", () => ({ subscribeStream: () => () => {} }));

/** A controllable `matchMedia` (jsdom has none, so without it every shell test ran the desktop branch — FND-0091). */
function mockViewport(initialDesktop: boolean) {
  let desktop = initialDesktop;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return desktop;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }),
  });
  return {
    set(next: boolean) {
      desktop = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const respond = (request: RecordedRequest) => (request.url === "/api/support/notifications" ? { body: { notifications: [], unread: 0 } } : { body: [] });
const toggle = () => document.querySelector<HTMLButtonElement>('button[aria-controls="support-panel"]')!;
const closeInPanel = () => fireEvent.click(within(screen.getByTestId("support-panel")).getByRole("button", { name: "Fechar suporte" }));

describe("OrbitShell layouts (Cycle Audit 3)", () => {
  test("FND-0091: on mobile the topbar opens the full-screen panel and '×' closes it", async () => {
    mockViewport(false);
    mockFetch(respond);
    const { container } = render(<OrbitShell />);
    await screen.findByText("Você ainda não falou com o suporte.");
    const shell = () => container.querySelector<HTMLElement>("[data-panel-open]")!;
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(shell().dataset.panelOpen).toBe("false");
    fireEvent.click(toggle());
    await waitFor(() => expect(shell().dataset.panelOpen).toBe("true"));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    closeInPanel();
    await waitFor(() => expect(shell().dataset.panelOpen).toBe("false"));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  test("FND-0090: a panel closed on desktop stays closed when the screen crosses to the mobile layout", async () => {
    const viewport = mockViewport(true);
    mockFetch(respond);
    render(<OrbitShell />);
    await screen.findByText("Você ainda não falou com o suporte.");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    closeInPanel(); // hidden on desktop
    await waitFor(() => expect(toggle().getAttribute("aria-expanded")).toBe("false"));
    fireEvent.click(toggle()); // shown again (the mobile flag goes up too)
    await waitFor(() => expect(toggle().getAttribute("aria-expanded")).toBe("true"));
    closeInPanel();
    await waitFor(() => expect(toggle().getAttribute("aria-expanded")).toBe("false"));
    viewport.set(false); // a rotated tablet
    await waitFor(() => expect(toggle().getAttribute("aria-expanded")).toBe("false"));
    viewport.set(true);
    await waitFor(() => expect(toggle().getAttribute("aria-expanded")).toBe("false"));
  });
});
