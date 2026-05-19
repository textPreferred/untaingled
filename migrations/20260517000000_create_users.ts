import type { Knex } from "knex";

/**
 * Runs the migration to create the users table.
 *
 * @param knex - The Knex instance for building SQL queries and running migrations.
 * @returns A promise that resolves when the migration is complete.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.increments("id");
    table.text("username").notNullable().unique();
    table.text("password_hash").notNullable();
    table.text("encrypted_db_key").notNullable();
    table.text("key_salt").notNullable();
  });
}

/**
 * Reverts the migrations by dropping the "users" table.
 *
 * @param knex - The Knex instance for database operations.
 * @returns A promise that resolves once the table is dropped.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("users");
}
