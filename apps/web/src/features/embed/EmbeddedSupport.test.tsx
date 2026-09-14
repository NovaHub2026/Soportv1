import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { mockFetch } from "@/features/support/test-utils";
import { EmbeddedSupport } from "./EmbeddedSupport";
import { allowedHostOrigins, isHostMessage } from "./embed-protocol";

vi.mock("@/lib/sse", () => ({ subscribeStream: () => () => {} }));

const HOST = "https://app.orbitmarket.pro";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A message as the host would post it: `event.origin` set, `source` irrelevant to the panel. */
function postFromHost(data: unknown, origin = HOST) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin }));
  });
}

describe("EmbeddedSupport (PH-13.2, DEC-0046 d)", () => {
  test("renders nothing identity-bound until an allowed host posts a session; then resolves the customer through /identity/me with the bearer and shows the panel without a simulation label", async () => {
    const { requests } = mockFetch((request) => {
      if (request.url === "/api/identity/me") return request.headers.authorization === "Bearer tok-1" ? { body: { kind: "customer", id: "PRF_01", source: "orbit" } } : { status: 401, body: { message: "identity_required" } };
      if (request.url === "/api/support/availability") return { body: { openNow: true, timezone: "America/Sao_Paulo", today: { open: "00:00", close: "24:00" }, nextOpening: null, alwaysOpen: true, todayWindow: null, nextOpeningAt: null, workingDefault: false, checkedAt: "" } };
      return { body: [] };
    });
    const posted: unknown[] = [];
    vi.spyOn(window, "parent", "get").mockReturnValue({ postMessage: (message: unknown) => posted.push(message) } as unknown as Window);
    const { container } = render(<EmbeddedSupport hostOrigins={[HOST]} />);
    expect(screen.getByTestId("embed-waiting").textContent).toBe("Conectando ao suporte…");
    expect(posted).toEqual([{ type: "orbit-support:ready" }]);
    expect(requests).toHaveLength(0);

    postFromHost({ type: "orbit-support:session", token: "tok-1" }, "https://evil.example");
    expect(requests).toHaveLength(0); // another origin is ignored

    postFromHost({ type: "orbit-support:session", token: "tok-1" });
    expect(await screen.findByTestId("embed-panel")).toBeDefined();
    expect(requests[0]).toMatchObject({ url: "/api/identity/me", headers: { authorization: "Bearer tok-1" } });
    expect(requests.every((r) => r.headers["x-simulated-customer-id"] === undefined)).toBe(true);
    // No "Conta simulada" strip for a real session (the e-mail outbox keeps its own simulation label: e-mail is still simulated).
    expect(container.querySelector('[class*="simulationStrip"]')).toBeNull();
    expect(screen.queryByText(/Conta simulada/)).toBeNull();
    expect(posted).toContainEqual({ type: "orbit-support:signed-in", customerId: "PRF_01" });
    await screen.findByRole("button", { name: "Falar com o suporte" });

    postFromHost({ type: "orbit-support:signout" });
    expect(screen.getByTestId("embed-waiting")).toBeDefined();
    expect(screen.queryByTestId("embed-panel")).toBeNull();
  });

  test("a token the API refuses asks the host for a fresh one and shows no one's data", async () => {
    mockFetch(() => ({ status: 401, body: { message: "identity_required" } }));
    const posted: unknown[] = [];
    vi.spyOn(window, "parent", "get").mockReturnValue({ postMessage: (message: unknown) => posted.push(message) } as unknown as Window);
    render(<EmbeddedSupport hostOrigins={[HOST]} />);
    postFromHost({ type: "orbit-support:session", token: "expired" });
    await waitFor(() => expect(posted).toContainEqual({ type: "orbit-support:token-required" }));
    expect(screen.getByTestId("embed-waiting").textContent).toContain("renovada");
    expect(screen.queryByTestId("embed-panel")).toBeNull();
  });

  test("without an allowed host list the page refuses to embed at all", () => {
    render(<EmbeddedSupport hostOrigins={[]} />);
    expect(screen.getByTestId("embed-refused")).toBeDefined();
  });

  test("protocol helpers: the origin list is parsed strictly and only known message types are host messages", () => {
    expect(allowedHostOrigins(" https://app.orbitmarket.pro/, http://localhost:3000 ,ftp://x, not-a-url")).toEqual(["https://app.orbitmarket.pro", "http://localhost:3000"]);
    expect(allowedHostOrigins(undefined)).toEqual([]);
    expect(isHostMessage({ type: "orbit-support:session", token: "t" })).toBe(true);
    expect(isHostMessage({ type: "orbit-support:evil" })).toBe(false);
    expect(isHostMessage("orbit-support:session")).toBe(false);
  });
});
