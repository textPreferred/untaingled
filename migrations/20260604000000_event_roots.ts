import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("event_roots", (table) => {
    table.integer("event_id").notNullable().references("id").inTable("events").onDelete("CASCADE");
    table
      .integer("root_event_id")
      .notNullable()
      .references("id")
      .inTable("events")
      .onDelete("CASCADE");
    table.primary(["event_id", "root_event_id"]);
  });

  await knex.raw(
    "INSERT INTO event_roots (event_id, root_event_id) " +
      "SELECT id, root_event_id FROM events WHERE root_event_id IS NOT NULL",
  );

  await knex.schema.alterTable("events", (table) => {
    table.dropColumn("root_event_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    table
      .integer("root_event_id")
      .nullable()
      .references("id")
      .inTable("events")
      .onDelete("SET NULL");
  });

  await knex.raw(
    "UPDATE events SET root_event_id = (" +
      "SELECT root_event_id FROM event_roots WHERE event_roots.event_id = events.id LIMIT 1" +
      ")",
  );

  await knex.schema.dropTable("event_roots");
}
