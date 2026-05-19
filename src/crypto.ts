import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Generates a cryptographic salt for hashing.
 * @returns {string} A random hex string representing the salt.
 */
export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString("hex");
}

export function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, KEY_LENGTH) as Buffer;
}

/**
 * Generates a random database key.
 *
 * @returns {Buffer} The generated database key as a buffer.
 */
export function generateDbKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

/**
 * Encrypts a database key using an authenticated encryption algorithm (AES-GCM).
 *
 * @param dbKey The database key to encrypt as a Buffer.
 * @param derivedKey The derived key to use for encryption as a Buffer.
 * @returns The encrypted database key encoded as a hexadecimal string.
 */
export function encryptDbKey(dbKey: Buffer, derivedKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(dbKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

/**
 * Decrypts an encrypted database key using the provided derived key.
 *
 * @param {string} encryptedDbKey - The encrypted database key in hex format.
 * @param {Buffer} derivedKey - The key used for decryption.
 * @returns {Buffer} The decrypted database key as a buffer.
 */
export function decryptDbKey(encryptedDbKey: string, derivedKey: Buffer): Buffer {
  const buf = Buffer.from(encryptedDbKey, "hex");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
