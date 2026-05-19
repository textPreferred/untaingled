import type { Knex } from "knex";

const config: Knex.Config = {
  client: "sqlite3",
  connection: {
    filename: process.env["USERS_DB_PATH"] ?? "users.db",
  },
  migrations: {
    directory: `${process.cwd()}/migrations`,
    extension: "ts",
  },
  useNullAsDefault: true,
};

export default config;
