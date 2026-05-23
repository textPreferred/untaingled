import type { Knex } from "knex";

const compiled = import.meta.url.includes("/dist/");
const config: Knex.Config = {
  client: "sqlite3",
  connection: {
    filename: process.env["USERS_DB_PATH"] ?? "users.db",
  },
  migrations: {
    directory: new URL(compiled ? "./migrations" : "../migrations", import.meta.url).pathname,
    extension: compiled ? "js" : "ts",
  },
  useNullAsDefault: true,
};

export default config;
