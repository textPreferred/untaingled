import type { Knex } from "knex";

const compiled = import.meta.url.includes("/dist/");
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const config: Knex.Config = {
  client: "pg",
  connection: databaseUrl,
  migrations: {
    directory: new URL(compiled ? "./migrations" : "../migrations", import.meta.url).pathname,
    extension: compiled ? "js" : "ts",
    loadExtensions: [".js", ".ts"],
  },
};

export default config;
