import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("events", (table) => {
    table.increments("id");
    table.text("title").notNullable();
    table.text("description").nullable();
    table
      .integer("root_event_id")
      .nullable()
      .references("id")
      .inTable("events")
      .onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("events");
}
