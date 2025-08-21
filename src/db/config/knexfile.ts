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
  // Allow tests to run in an isolated schema, while keeping public for extensions
  searchPath: [process.env.DB_SCHEMA || 'public', 'public'],
  migrations: {
    directory: "./migrations", // resolves to backend/src/db/migrations
    extension: "ts",
    // Skip strict validation comparing on-disk files to previously seen names
    // Useful in demo builds where files may be renamed, merged, or pruned
    disableMigrationsListValidation: true,
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