import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    // Deterministic per-user HMAC of the date string, used to dedup date
    // events whose titles are now encrypted. Null for non-date events.
    table.text("date_lookup").nullable();
    table.index(["user_id", "date_lookup"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("events", (table) => {
    table.dropColumn("date_lookup");
  });
}
