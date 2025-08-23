import 'dotenv/config';
import { defineConfig } from "drizzle-kit";
import 'dotenv/config';             // <-- add this line

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { 
    url: process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL! 
  }
});