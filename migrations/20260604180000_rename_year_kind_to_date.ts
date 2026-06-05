import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex("events").where({ kind: "year" }).update({ kind: "date" });
}

export async function down(knex: Knex): Promise<void> {
  await knex("events").where({ kind: "date" }).update({ kind: "year" });
}
