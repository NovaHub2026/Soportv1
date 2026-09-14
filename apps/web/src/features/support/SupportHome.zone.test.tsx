import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SupportHome } from "./SupportHome";
import { identity, mockFetch } from "./test-utils";

/**
 * The customer's clock is Tokyo (UTC+9) while the operation runs in São Paulo (UTC−3): the availability line is
 * asserted with literal strings, not with the implementation's own formatter (closing audit FND-0111/FND-0114).
 */
vi.hoisted(() => {
  process.env.TZ = "Asia/Tokyo";
});

vi.mock("@/lib/sse", () => ({ subscribeStream: () => () => {} }));

// Monday 09:00–18:00 in São Paulo = Monday 12:00Z–21:00Z = Monday 21:00 to Tuesday 06:00 in Tokyo.
const window = { opensAt: "2026-09-14T12:00:00.000Z", closesAt: "2026-09-14T21:00:00.000Z" };
const nextOpeningAt = "2026-09-16T12:00:00.000Z"; // Wednesday 09:00 São Paulo = Wednesday 21:00 Tokyo

function availability(now: string, openNow: boolean, allDay = false) {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(now) });
  mockFetch((request) =>
    request.url === "/api/support/availability"
      ? { body: { openNow, timezone: "America/Sao_Paulo", today: allDay ? { open: "00:00", close: "24:00" } : { open: "09:00", close: "18:00" }, nextOpening: { weekday: "wed", open: "09:00" }, alwaysOpen: false, todayWindow: window, nextOpeningAt, workingDefault: false, checkedAt: now } }
      : { body: [] },
  );
  render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
  return screen.findByTestId("availability");
}

describe("SupportHome availability in a far time zone", () => {
  beforeEach(() => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tokyo");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("before the opening on the customer's own day: 'Hoje' with the window as Tokyo reads it", async () => {
    const line = await availability("2026-09-14T10:00:00.000Z", false); // Monday 19:00 Tokyo
    expect(line.textContent).toContain("Atendimento fechado agora. Hoje: 21:00–06:00. Próximo atendimento: quarta às 21:00.");
    expect(line.textContent).toContain("Horários no seu fuso (Asia/Tokyo).");
  });

  test("open, but the window started on the customer's previous day: the weekday is named instead of 'Hoje'", async () => {
    const line = await availability("2026-09-14T20:00:00.000Z", true); // Tuesday 05:00 Tokyo
    expect(line.textContent).toContain("Atendimento aberto agora. Segunda: 21:00–06:00.");
    expect(line.textContent).not.toContain("Hoje");
  });

  test("closed after the window ended in the customer's clock: only the next opening is announced", async () => {
    const line = await availability("2026-09-15T01:00:00.000Z", false); // Tuesday 10:00 Tokyo
    expect(line.textContent).toContain("Atendimento fechado agora. Próximo atendimento: quarta às 21:00.");
    expect(line.textContent).not.toContain("Hoje");
    expect(line.textContent).not.toContain("21:00–06:00");
  });

  test("a day open around the clock that began on the customer's previous day says until when", async () => {
    const allDayWindow = { opensAt: "2026-09-14T03:00:00.000Z", closesAt: "2026-09-15T03:00:00.000Z" }; // Monday São Paulo = Mon 12:00 to Tue 12:00 Tokyo
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-14T20:00:00.000Z") }); // Tuesday 05:00 Tokyo
    mockFetch((request) =>
      request.url === "/api/support/availability"
        ? { body: { openNow: true, timezone: "America/Sao_Paulo", today: { open: "00:00", close: "24:00" }, nextOpening: { weekday: "wed", open: "09:00" }, alwaysOpen: false, todayWindow: allDayWindow, nextOpeningAt, workingDefault: false, checkedAt: "" } }
        : { body: [] },
    );
    render(<SupportHome identity={identity} onNewRequest={() => {}} onOpenCase={() => {}} />);
    const line = await screen.findByTestId("availability");
    expect(line.textContent).toContain("Atendimento aberto agora. Atendimento 24 horas até terça às 12:00.");
  });
});
