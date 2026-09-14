import { describe, expect, test } from "vitest";
import { accessRecoveryInputSchema, formatRecoveryReference, looksLikeContact } from "./access.js";

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

  test("formats the reference", () => {
    expect(formatRecoveryReference(1)).toBe("REC-000001");
    expect(() => formatRecoveryReference(0)).toThrow(RangeError);
  });
});
