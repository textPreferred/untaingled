import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.increments("id");
    table.text("username").notNullable().unique();
    table.text("password_hash").notNullable();
    table.text("encrypted_db_key").notNullable();
    table.text("key_salt").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("users");
}
