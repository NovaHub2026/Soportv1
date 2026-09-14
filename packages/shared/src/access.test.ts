import { describe, expect, test } from "vitest";
import { accessRecoveryInputSchema, accessRecoveryOutcomeSchema, formatRecoveryReference, looksLikeContact, normalizeContact, maskLikelySecrets, SECRET_MASK } from "./access.js";

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

  test("BL-027: likely secrets are masked for staff, words about secrets are kept", () => {
    const masked = (t: string) => maskLikelySecrets(t);
    expect(masked("Minha senha é Abc12345 e não entra.")).toEqual({ text: `Minha senha é ${SECRET_MASK} e não entra.`, masked: true });
    expect(masked("O código 482913 expirou antes de eu digitar.")).toEqual({ text: `O código ${SECRET_MASK} expirou antes de eu digitar.`, masked: true });
    expect(masked("password: hunter22!")).toEqual({ text: `password: ${SECRET_MASK}`, masked: true });
    expect(masked("Recebi 123456 por SMS")).toEqual({ text: `Recebi ${SECRET_MASK} por SMS`, masked: true });
    expect(masked("Frase de recuperação: CorrectHorseBattery")).toEqual({ text: `Frase de recuperação: ${SECRET_MASK}`, masked: true });
    // Closing audit FND-0108: other languages, spaced digits, all-caps codes and a real (lowercase, twelve-word) seed phrase.
    expect(masked("Mi clave es Xy7pq9 y no entra.")).toEqual({ text: `Mi clave es ${SECRET_MASK} y no entra.`, masked: true });
    expect(masked("A chave de acesso 77aa88bb não funciona.")).toEqual({ text: `A chave de acesso ${SECRET_MASK} não funciona.`, masked: true });
    expect(masked("senha: 4 8 2 9 1 3")).toEqual({ text: `senha: ${SECRET_MASK}`, masked: true });
    expect(masked("Código: ABCDEFGH")).toEqual({ text: `Código: ${SECRET_MASK}`, masked: true });
    expect(masked("Minhas senhas: Abc12345 e Def67890.")).toEqual({ text: `Minhas senhas: ${SECRET_MASK} e Def67890.`, masked: true });
    expect(masked("Minha frase de recuperação é apple banana cherry dog elephant fig grape house iron jelly kite lemon. Não entra.")).toEqual({ text: `Minha frase de recuperação é ${SECRET_MASK}. Não entra.`, masked: true });
    expect(masked("seed phrase: abandon ability able about above absent absorb abstract absurd abuse access accident")).toEqual({ text: `seed phrase: ${SECRET_MASK}`, masked: true });
    // Talk about a secret, no secret: kept whole.
    for (const text of ["A senha nunca chega.", "O código não chega no e-mail.", "Esqueci a senha e o telefone é +55 11 99999-1234.", "Meu pedido SUP-000123 de 13/09/2026.", "Perdi a frase de recuperação e não consigo entrar na minha conta, o que eu faço agora?"]) {
      expect(masked(text)).toEqual({ text, masked: false });
    }
  });
});
