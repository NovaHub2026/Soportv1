import { describe, expect, test } from "vitest";
import { createCaseSchema, deriveSubject, formatCaseReference, postMessageSchema } from "./cases.js";

describe("formatCaseReference", () => {
  test("pads to six digits with the SUP prefix", () => {
    expect(formatCaseReference(1)).toBe("SUP-000001");
    expect(formatCaseReference(123456)).toBe("SUP-123456");
  });

  test("keeps every digit beyond six", () => {
    expect(formatCaseReference(1234567)).toBe("SUP-1234567");
  });

  test("rejects non-positive or fractional numbers", () => {
    expect(() => formatCaseReference(0)).toThrow(RangeError);
    expect(() => formatCaseReference(1.5)).toThrow(RangeError);
  });
});

describe("deriveSubject", () => {
  test("uses the first line, collapsed", () => {
    expect(deriveSubject("  Meu saque   não chegou\nDetalhes...")).toBe("Meu saque não chegou");
  });

  test("truncates long lines with an ellipsis", () => {
    const subject = deriveSubject("a".repeat(200));
    expect(subject.length).toBe(80);
    expect(subject.endsWith("…")).toBe(true);
  });
});

describe("request schemas", () => {
  test("createCaseSchema requires category and a non-empty message", () => {
    expect(createCaseSchema.safeParse({ category: "other", message: "   " }).success).toBe(false);
    expect(createCaseSchema.safeParse({ category: "nope", message: "x" }).success).toBe(false);
    const ok = createCaseSchema.safeParse({ category: "operations", message: " Olá ", clientMessageId: "c1" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.message).toBe("Olá");
  });

  test("postMessageSchema rejects oversized bodies", () => {
    expect(postMessageSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
    expect(postMessageSchema.safeParse({ body: "ok" }).success).toBe(true);
  });
});

describe("customer projection (FND-0006)", () => {
  test("toCustomerCaseSummary removes every staff-only field and keeps the rest", async () => {
    const { STAFF_ONLY_SUMMARY_FIELDS, toCustomerCaseSummary, customerCaseSummarySchema } = await import("./cases.js");
    const summary = {
      id: "c1", reference: "SUP-000001", customerId: "cust-1", subject: "s", category: "other", status: "new",
      priority: "urgent", assignedAgentId: "staff-ana", createdAt: "t", updatedAt: "t", lastMessageAt: "t",
      lastCustomerMessageAt: null, lastStaffMessageAt: null, customerLastReadAt: null, staffLastReadAt: "t",
      unreadCount: 0, resolvedAt: null, resolutionReason: null, closedAt: null, parentCaseId: null, parentReference: null,
      incidentId: "i1", incidentTitle: "INTERNO: provedor fora", recordKind: null, recordReference: null, awaitingReplySince: "t",
    } as const;
    const projected = toCustomerCaseSummary(summary);
    for (const field of STAFF_ONLY_SUMMARY_FIELDS) expect(field in projected).toBe(false);
    expect(projected).toMatchObject({ id: "c1", reference: "SUP-000001", status: "new", customerLastReadAt: null });
    expect(customerCaseSummarySchema.safeParse(projected).success).toBe(true);
  });

  test("text fields refuse NUL bytes (FND-0016)", () => {
    expect(postMessageSchema.safeParse({ body: "ok\u0000bad" }).success).toBe(false);
    expect(createCaseSchema.safeParse({ category: "other", message: "ok", subject: "a\u0000b" }).success).toBe(false);
    expect(postMessageSchema.safeParse({ body: "ok \u001b[31m" }).success).toBe(true);
  });
});
