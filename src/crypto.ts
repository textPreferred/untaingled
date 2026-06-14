import { randomBytes, createCipheriv, createDecipheriv, createHmac, scryptSync } from "node:crypto";

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

/**
 * Derives a cryptographic key from a password and salt.
 * @param password The password to derive the key from.
 * @param salt The salt to use in key derivation.
 * @returns The derived key as a Buffer.
 */
export function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
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

/**
 * Encrypts a UTF-8 string with AES-256-GCM under the given key.
 * Output is hex-encoded `iv | tag | ciphertext`. A random IV makes the
 * ciphertext non-deterministic, so identical plaintexts differ on disk.
 *
 * @param plaintext The string to encrypt.
 * @param key A 32-byte key (the per-user dbKey).
 * @returns The encrypted value as a hex string.
 */
export function encryptString(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

/**
 * Decrypts a string produced by {@link encryptString}.
 *
 * @param ciphertext The hex-encoded `iv | tag | ciphertext`.
 * @param key The 32-byte key used to encrypt.
 * @returns The decrypted UTF-8 string. Throws if the tag fails to verify.
 */
export function decryptString(ciphertext: string, key: Buffer): string {
  const buf = Buffer.from(ciphertext, "hex");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Derives a deterministic, per-user lookup token for a value via HMAC-SHA256.
 * Used to dedup date events without storing their plaintext: the same value
 * under the same key always yields the same token, but the token reveals
 * nothing without the key.
 *
 * @param value The value to tokenize (e.g. a normalized date string).
 * @param key The per-user dbKey.
 * @returns The lookup token as a hex string.
 */
export function lookupToken(value: string, key: Buffer): string {
  return createHmac("sha256", key).update(value).digest("hex");
}
