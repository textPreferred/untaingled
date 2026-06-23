import { db } from "../db";
import { CURRENT_KDF_PARAMS_SERIALIZED } from "../config";
import {
  CURRENT_KDF_PARAMS,
  decryptDbKey,
  deriveKey,
  encryptDbKey,
  generateDbKey,
  generateSalt,
  parseKdfParams,
} from "../crypto";
import type { UserRow } from "../types";
import type { PendingPassphrase } from "./pendingStore";

// A resolved login: the user's id plus their decrypted per-session dbKey. Failures
// carry the HTTP status and message the route should surface unchanged.
export type AccountResult =
  | { ok: true; userId: number; dbKey: Buffer }
  | { ok: false; status: 400 | 401 | 404; error: string };

/**
 * Re-wraps a user's dbKey under the current scrypt cost when their stored
 * params are below target. Called right after a successful login, while we
 * still hold the plaintext passphrase. The dbKey itself is unchanged, so event
 * ciphertext is untouched — only the small key envelope is rewritten.
 */
export async function upgradeKdfParams(
  userId: number,
  passphrase: string,
  dbKey: Buffer,
  storedParams: string | null,
): Promise<void> {
  if (storedParams === CURRENT_KDF_PARAMS_SERIALIZED) return;
  const newSalt = generateSalt();
  const newEncryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, newSalt, CURRENT_KDF_PARAMS));
  await db("users").where({ id: userId }).update({
    encrypted_db_key: newEncryptedDbKey,
    key_salt: newSalt,
    kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
  });
}

// Brand-new Auth0 user: mint a fresh dbKey wrapped under their chosen passphrase.
export async function createUserWithPassphrase(
  auth0Sub: string,
  passphrase: string,
): Promise<AccountResult> {
  const salt = generateSalt();
  const dbKey = generateDbKey();
  const encryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, salt, CURRENT_KDF_PARAMS));
  const [user] = await db("users")
    .insert({
      auth0_sub: auth0Sub,
      encrypted_db_key: encryptedDbKey,
      key_salt: salt,
      kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
    })
    .returning(["id"]);
  return { ok: true, userId: user.id as number, dbKey };
}

// Legacy password user adopting Auth0: verify their old password, claim the
// auth0_sub, and re-wrap the dbKey under the (now passphrase-only) credential.
export async function migrateLegacyUser(
  auth0Sub: string,
  username: string,
  passphrase: string,
): Promise<AccountResult> {
  const user = (await db("users")
    .whereNull("auth0_sub")
    .whereNotNull("password_hash")
    .where({ username })
    .first()) as UserRow | undefined;
  if (!user) return { ok: false, status: 401, error: "Invalid credentials" };

  const valid = await Bun.password.verify(passphrase, user.password_hash!);
  if (!valid) return { ok: false, status: 401, error: "Invalid credentials" };

  const dbKey = decryptDbKey(
    user.encrypted_db_key,
    deriveKey(passphrase, user.key_salt, parseKdfParams(user.kdf_params)),
  );

  // Re-encrypt dbKey: passphrase is now the encryption passphrase too, and
  // re-wrap at the current scrypt cost while we're at it.
  const newSalt = generateSalt();
  const newEncryptedDbKey = encryptDbKey(dbKey, deriveKey(passphrase, newSalt, CURRENT_KDF_PARAMS));
  await db("users").where({ id: user.id }).update({
    auth0_sub: auth0Sub,
    encrypted_db_key: newEncryptedDbKey,
    key_salt: newSalt,
    kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
    password_hash: null,
  });
  return { ok: true, userId: user.id, dbKey };
}

// Returning Auth0 user: decrypt their dbKey with the supplied passphrase,
// upgrading the envelope cost if it lags the current target.
export async function loginReturningUser(
  pending: PendingPassphrase,
  passphrase: string,
): Promise<AccountResult> {
  let dbKey: Buffer;
  try {
    dbKey = decryptDbKey(
      pending.encryptedDbKey!,
      deriveKey(passphrase, pending.keySalt!, parseKdfParams(pending.keyParams)),
    );
  } catch {
    return { ok: false, status: 401, error: "Wrong passphrase" };
  }
  const user = (await db("users").where({ auth0_sub: pending.auth0Sub }).first()) as
    | UserRow
    | undefined;
  if (!user) return { ok: false, status: 400, error: "User not found" };
  await upgradeKdfParams(user.id, passphrase, dbKey, pending.keyParams ?? null);
  return { ok: true, userId: user.id, dbKey };
}

// Verify the current passphrase, then re-wrap the in-session dbKey under a new one.
export async function changePassphrase(
  userId: number,
  dbKey: Buffer,
  currentPassphrase: string,
  newPassphrase: string,
): Promise<AccountResult> {
  const user = (await db("users").where({ id: userId }).first()) as UserRow | undefined;
  if (!user) return { ok: false, status: 404, error: "User not found" };

  try {
    decryptDbKey(
      user.encrypted_db_key,
      deriveKey(currentPassphrase, user.key_salt, parseKdfParams(user.kdf_params)),
    );
  } catch {
    return { ok: false, status: 401, error: "Wrong passphrase" };
  }

  const newSalt = generateSalt();
  const newEncryptedDbKey = encryptDbKey(
    dbKey,
    deriveKey(newPassphrase, newSalt, CURRENT_KDF_PARAMS),
  );
  await db("users").where({ id: userId }).update({
    encrypted_db_key: newEncryptedDbKey,
    key_salt: newSalt,
    kdf_params: CURRENT_KDF_PARAMS_SERIALIZED,
  });
  return { ok: true, userId, dbKey };
}
