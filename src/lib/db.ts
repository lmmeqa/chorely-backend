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

function maskDbUrl(u: string) {
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.username || '<user>'}@${x.hostname}:${x.port || '5432'}${x.pathname}`;
  } catch {
    return '<invalid DATABASE_URL>';
  }
}

export function dbFromEnv(env: Bindings) {
  // More reliable environment detection
  const isWorkers = typeof (globalThis as any).WebSocketPair !== 'undefined' || 
                   typeof (globalThis as any).__CLOUDFLARE_WORKER__ !== 'undefined' ||
                   typeof (globalThis as any).process?.versions?.node === 'undefined';

  // ✅ Node (local/dev/tests): use DATABASE_URL directly (matches .env)
  if (!isWorkers) {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in local/dev Node environment');
    }
    if (!__nodeDb || __nodeConnStr !== env.DATABASE_URL) {
      const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });
      __nodeDb = drizzleNode(pool, { logger: !process.env.MUTE_DB_LOGS });
      __nodeConnStr = env.DATABASE_URL;
      console.log('[db] Node driver connected →', maskDbUrl(env.DATABASE_URL));
    }
    return __nodeDb!;
  }

  // Workers/edge (e.g., Neon HTTP)
  const sql = neon(env.DATABASE_URL);
  console.log('[db] Neon HTTP driver →', maskDbUrl(env.DATABASE_URL));
  return drizzleNeon(sql);
}