import { describe, expect, it } from "vitest";
import {
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from "../../src/auth/totp";

describe("totp", () => {
  it("generates base32 secrets and verifies matching codes", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });
});
