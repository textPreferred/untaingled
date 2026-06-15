import { describe, test, expect } from "bun:test";
import {
  encryptString,
  decryptString,
  lookupToken,
  generateDbKey,
  generateSalt,
  deriveKey,
  encryptDbKey,
  decryptDbKey,
  serializeKdfParams,
  parseKdfParams,
  LEGACY_KDF_PARAMS,
  CURRENT_KDF_PARAMS,
} from "./crypto";

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

describe("kdf params", () => {
  test("serialize/parse round-trips", () => {
    expect(parseKdfParams(serializeKdfParams(CURRENT_KDF_PARAMS))).toEqual(CURRENT_KDF_PARAMS);
    expect(serializeKdfParams({ N: 131072, r: 8, p: 1 })).toBe("scrypt$N=131072,r=8,p=1");
  });

  test("treats null/undefined (un-backfilled legacy rows) as legacy params", () => {
    expect(parseKdfParams(null)).toEqual(LEGACY_KDF_PARAMS);
    expect(parseKdfParams(undefined)).toEqual(LEGACY_KDF_PARAMS);
  });

  test("target cost is stronger than legacy", () => {
    expect(CURRENT_KDF_PARAMS.N).toBeGreaterThan(LEGACY_KDF_PARAMS.N);
  });
});

describe("deriveKey with explicit params", () => {
  test("derives a usable key at the high-cost target params (maxmem must allow it)", () => {
    const salt = generateSalt();
    const key = deriveKey("correct horse", salt, CURRENT_KDF_PARAMS);
    expect(key.length).toBe(32);
  });

  test("same passphrase+salt yields different keys under different params", () => {
    const salt = generateSalt();
    const legacy = deriveKey("pw", salt, LEGACY_KDF_PARAMS);
    const current = deriveKey("pw", salt, CURRENT_KDF_PARAMS);
    expect(legacy.equals(current)).toBe(false);
  });
});

describe("envelope upgrade across a cost bump (existing-user safety)", () => {
  test("legacy-wrapped dbKey opens with legacy params, then re-wraps to current", () => {
    const passphrase = "correct-horse-battery-staple";
    const dbKey = generateDbKey();

    // Existing user: dbKey wrapped under legacy params.
    const oldSalt = generateSalt();
    const oldWrapped = encryptDbKey(dbKey, deriveKey(passphrase, oldSalt, LEGACY_KDF_PARAMS));

    // Login: decrypt with the params recorded for that user.
    const opened = decryptDbKey(oldWrapped, deriveKey(passphrase, oldSalt, LEGACY_KDF_PARAMS));
    expect(opened.equals(dbKey)).toBe(true);

    // Lazy re-wrap to current params (new salt), dbKey itself unchanged.
    const newSalt = generateSalt();
    const newWrapped = encryptDbKey(opened, deriveKey(passphrase, newSalt, CURRENT_KDF_PARAMS));

    // Next login uses current params and still recovers the same dbKey.
    const reopened = decryptDbKey(newWrapped, deriveKey(passphrase, newSalt, CURRENT_KDF_PARAMS));
    expect(reopened.equals(dbKey)).toBe(true);

    // Old params no longer open the re-wrapped envelope.
    expect(() =>
      decryptDbKey(newWrapped, deriveKey(passphrase, newSalt, LEGACY_KDF_PARAMS)),
    ).toThrow();
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
