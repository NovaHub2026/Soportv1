import { describe, expect, test } from "vitest";
import { accessRecoveryInputSchema, accessRecoveryOutcomeSchema, formatRecoveryReference, looksLikeContact, normalizeContact } from "./access.js";

const valid = "Não consigo entrar na conta.";

describe("access recovery contracts (PH-7.1, §4.5)", () => {
  test("accepts an e-mail or a phone as contact and refuses anything else, NUL and short descriptions", () => {
    expect(looksLikeContact("alice@example.com")).toBe(true);
    expect(looksLikeContact("+55 11 99999-1234")).toBe(true);
    expect(looksLikeContact("alice")).toBe(false);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice@example.com", description: "Não recebo o código de verificação." }).success).toBe(true);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice", description: "Não recebo o código de verificação." }).success).toBe(false);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice@example.com", description: "curto" }).success).toBe(false);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice@example.com", description: "Não recebo o código\u0000" }).success).toBe(false);
  });

  test("refuses control and bidi characters that could spoof what staff read, but keeps line breaks (Cycle Audit 3)", () => {
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice\u202E@example.com", description: valid }).success).toBe(false);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice\u200B@example.com", description: valid }).success).toBe(false);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice@example.com", description: "Texto com \u202Eoverride invertido." }).success).toBe(false);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice@example.com", description: "Sino \u0007 no meio do texto." }).success).toBe(false);
    expect(accessRecoveryInputSchema.safeParse({ contact: "alice@example.com", description: "Primeira linha.\nSegunda linha." }).success).toBe(true);
    expect(accessRecoveryOutcomeSchema.safeParse({ outcome: "closed", note: "nota \u202E" }).success).toBe(false);
  });

  test("normalizes contacts so formatting variants count as one contact (Cycle Audit 3)", () => {
    const email = normalizeContact("alice@example.com");
    for (const variant of ["Alice@Example.com", " alice@example.com. ", "alice+promo@example.com", "\uFF41lice@example.com", "alice\u200B@example.com"]) {
      expect(normalizeContact(variant)).toBe(email);
    }
    const phone = normalizeContact("+55 11 99999-1234");
    for (const variant of ["5511999991234", "+55 (11) 99999 1234", "+55.11.99999.1234", "+55  11  99999-1234"]) {
      expect(normalizeContact(variant)).toBe(phone);
    }
    expect(normalizeContact("bob@example.com")).not.toBe(email);
  });

  test("formats the reference", () => {
    expect(formatRecoveryReference(1)).toBe("REC-000001");
    expect(() => formatRecoveryReference(0)).toThrow(RangeError);
  });
});
