// src/lib/db.ts
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export type Bindings = {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET?: string;
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
};

let __nodeDb: ReturnType<typeof drizzleNode> | null = null;
let __nodeConnStr = '';

export function dbFromEnv(env: Bindings) {
  // If running under Node (tests), use pg.Pool
  if (typeof (globalThis as any).process?.versions?.node === 'string') {
    const conn = env.DATABASE_URL || buildNodeConnStr(env);
    if (!__nodeDb || __nodeConnStr !== conn) {
      __nodeConnStr = conn;
      const pool = new pg.Pool({ connectionString: conn, max: 10, idleTimeoutMillis: 30_000 } as any);
      __nodeDb = drizzleNode(pool);
    }
    return __nodeDb!;
  }

  // Default (worker): Neon HTTP
  const sql = neon(env.DATABASE_URL);
  return drizzleNeon(sql);
}

function buildNodeConnStr(env: Bindings) {
  const host = env.DB_HOST || 'localhost';
  const port = String(env.DB_PORT || '5433'); // default to 5433 for tests
  const user = env.DB_USER || 'postgres';
  const password = env.DB_PASSWORD || 'password';
  const database = env.DB_NAME || 'postgres';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}