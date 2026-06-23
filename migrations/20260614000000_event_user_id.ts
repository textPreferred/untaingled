import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Pre-isolation events have no owner and predate at-rest encryption, so they
  // cannot be attributed to a user nor decrypted. Drop them before adding the
  // NOT NULL user_id column. event_roots cascades on delete.
  await knex("events").del();

  await knex.schema.alterTable("events", (table) => {
    table.integer("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.index("user_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    table.dropColumn("user_id");
  });
}
