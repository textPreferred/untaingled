import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.text("username").nullable().alter();
  });
  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_identifier_required " +
      "CHECK (username IS NOT NULL OR auth0_sub IS NOT NULL)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identifier_required");
  await knex.schema.alterTable("users", (table) => {
    table.text("username").notNullable().alter();
  });
}
