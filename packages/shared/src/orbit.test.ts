import { describe, expect, test } from "vitest";
import { maskEmail, maskPhone } from "./orbit.js";

describe("masking (PROJECT_CONTEXT.md §10.2)", () => {
  test("maskEmail keeps one character of the local part and of the host plus the TLD", () => {
    expect(maskEmail("alice.souza@example.com")).toBe("a***@e***.com");
    expect(maskEmail("b@orbit.com.br")).toBe("b***@o***.br");
    expect(maskEmail("not-an-email")).toBe("***");
  });

  test("maskPhone keeps the country code and the last four digits only", () => {
    expect(maskPhone("+55 11 99999-1234")).toBe("+55 ••• ••• 1234");
    expect(maskPhone("(11) 98888-7777")).toBe("••• ••• 7777");
    expect(maskPhone("12")).toBe("•••");
  });
});
