import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
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
