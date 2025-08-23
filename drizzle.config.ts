import 'dotenv/config';
import { defineConfig } from "drizzle-kit";

// Default config (local development)
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",              // generated SQL migrations go here (commit this folder)
  dbCredentials: { url: process.env.DATABASE_URL! }
});
