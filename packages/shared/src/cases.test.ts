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
