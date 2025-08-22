import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// in Worker: read from bindings/secrets
export function dbFromEnv(env: { DATABASE_URL: string }) {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql);
}
