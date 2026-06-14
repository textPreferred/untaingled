import { describe, test, expect } from "bun:test";
import { encryptString, decryptString, lookupToken, generateDbKey } from "./crypto";

describe("encryptString / decryptString", () => {
  test("round-trips a string", () => {
    const key = generateDbKey();
    const ct = encryptString("hello world", key);
    expect(ct).not.toContain("hello");
    expect(decryptString(ct, key)).toBe("hello world");
  });

  test("produces different ciphertext each call (random IV)", () => {
    const key = generateDbKey();
    expect(encryptString("same", key)).not.toBe(encryptString("same", key));
  });

  test("fails to decrypt with the wrong key", () => {
    const ct = encryptString("secret", generateDbKey());
    expect(() => decryptString(ct, generateDbKey())).toThrow();
  });

  test("fails to decrypt tampered ciphertext", () => {
    const key = generateDbKey();
    const ct = encryptString("secret", key);
    const tampered = ct.slice(0, -2) + (ct.endsWith("0") ? "1" : "0");
    expect(() => decryptString(tampered, key)).toThrow();
  });
});

describe("lookupToken", () => {
  test("is deterministic for the same value and key", () => {
    const key = generateDbKey();
    expect(lookupToken("2020-05", key)).toBe(lookupToken("2020-05", key));
  });

  test("differs across values and across keys", () => {
    const k1 = generateDbKey();
    const k2 = generateDbKey();
    expect(lookupToken("2020", k1)).not.toBe(lookupToken("2021", k1));
    expect(lookupToken("2020", k1)).not.toBe(lookupToken("2020", k2));
  });
});
