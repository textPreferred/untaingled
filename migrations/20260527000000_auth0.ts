import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.text("auth0_sub").unique().nullable();
    table.text("password_hash").nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("auth0_sub");
    table.text("password_hash").notNullable().alter();
  });
}
