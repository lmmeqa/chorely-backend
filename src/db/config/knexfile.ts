import type { Knex } from "knex";
const config: Knex.Config = {
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "db",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "chorely",
    timezone: "America/Los_Angeles",
  },
  migrations: {
    directory: "./migrations", // resolves to backend/src/db/migrations
    extension: "ts",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
  pool: {
    min: 2,
    max: 10,
  },
};
export default config;
module.exports = config;