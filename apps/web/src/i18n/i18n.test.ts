import { CASE_CATEGORIES, CASE_STATUSES } from "@orbit-support/shared";
import { describe, expect, test } from "vitest";
import { formatMessageTime, getDictionary } from "./index";

describe("pt-BR dictionary", () => {
  const dict = getDictionary("pt-BR");

  test("labels every case status and category from the shared vocabulary", () => {
    for (const status of CASE_STATUSES) expect(dict.status[status]).toBeTruthy();
    for (const category of CASE_CATEGORIES) expect(dict.category[category]).toBeTruthy();
  });

  test("customer-facing status labels follow the product table (context §7)", () => {
    expect(dict.status.new).toBe("Recebido");
    expect(dict.status.waiting_customer).toBe("Aguardando sua resposta");
    expect(dict.status.closed).toBe("Encerrado");
  });
});

describe("formatMessageTime", () => {
  test("shows only the time for today and date + time otherwise", () => {
    const now = new Date(2026, 8, 13, 15, 0);
    expect(formatMessageTime(new Date(2026, 8, 13, 14, 5).toISOString(), now)).toBe("14:05");
    expect(formatMessageTime(new Date(2026, 8, 12, 9, 30).toISOString(), now)).toMatch(/12\/09,? 09:30/);
  });
});
