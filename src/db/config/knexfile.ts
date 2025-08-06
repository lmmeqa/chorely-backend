import type { Knex } from "knex";
const config: Knex.Config = {
  client: "pg",
  connection:
    process.env.DATABASE_URL || "postgres://postgres:password@db:5432/chorely",
  migrations: {
    directory: "./migrations", // resolves to backend/src/db/migrations
    extension: "ts",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};
export default config;
module.exports = config;