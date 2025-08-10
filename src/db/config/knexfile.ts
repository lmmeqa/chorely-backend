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
    afterCreate: (conn: any, done: any) => {
      // Set timezone for each connection
      conn.query("SET timezone = 'America/Los_Angeles'", done);
    },
  },
};
export default config;
module.exports = config;