import type { Knex } from "knex";

/** scrypt params recorded for rows that predate this column (Node's old
 * defaults). Must match LEGACY_KDF_PARAMS in src/crypto.ts. */
const LEGACY_KDF_PARAMS = "scrypt$N=16384,r=8,p=1";

/**
 * Adds the per-user `kdf_params` column so the scrypt cost factor can be raised
 * without locking out existing users: each row records the params its
 * `encrypted_db_key` was wrapped under. Existing rows are backfilled with the
 * legacy params they actually used.
 *
 * @param knex - The Knex instance for building SQL queries and running migrations.
 * @returns A promise that resolves when the migration is complete.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.text("kdf_params");
  });
  await knex("users").whereNull("kdf_params").update({ kdf_params: LEGACY_KDF_PARAMS });
}

/**
 * Drops the `kdf_params` column.
 *
 * @param knex - The Knex instance for database operations.
 * @returns A promise that resolves once the column is dropped.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("kdf_params");
  });
}
