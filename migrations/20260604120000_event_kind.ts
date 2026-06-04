import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    table.text("kind").notNullable().defaultTo("event");
  });
  await knex("events").whereRaw("title ~ '^[0-9]{4}$'").update({ kind: "year" });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    table.dropColumn("kind");
  });
}
