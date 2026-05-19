import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString("hex");
}

export function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, KEY_LENGTH) as Buffer;
}

export function generateDbKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

export function encryptDbKey(dbKey: Buffer, derivedKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(dbKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

export function decryptDbKey(encryptedDbKey: string, derivedKey: Buffer): Buffer {
  const buf = Buffer.from(encryptedDbKey, "hex");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
