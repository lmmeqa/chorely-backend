import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default async function() {
  if (process.env.NODE_ENV !== 'test') return;

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5433');
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_NAME || 'chorely';
  const connectionString = process.env.DATABASE_URL;

  const client = connectionString
    ? new Client({ connectionString })
    : new Client({ host, port, user, password, database });
  await client.connect();
  // Ensure required schema/extension exist (tests use public)
  await client.query(`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await client.query(`CREATE SCHEMA IF NOT EXISTS public`);
  await client.query(`SET search_path TO public`);
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  // Clean public schema for fresh Drizzle migration run (ignore if relations missing)
  await client.query(`DO $$ BEGIN
    EXECUTE 'DROP TABLE IF EXISTS chore_approvals, dispute_votes, disputes, todo_items, chores, user_homes, users, home CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  await client.query(`DO $$ BEGIN
    EXECUTE 'DROP TYPE IF EXISTS chore_status CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  await client.query(`DO $$ BEGIN
    EXECUTE 'DROP TYPE IF EXISTS dispute_status CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  await client.query(`DO $$ BEGIN
    EXECUTE 'DROP TYPE IF EXISTS vote_type CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  
  const db = drizzle(client);
  
  // Run Drizzle migrations
  await migrate(db, { migrationsFolder: './drizzle' });

  // Verify critical tables now exist; fail fast if not
  const verify = await client.query(`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public' and table_name in ('users','home','chores')
  `);
  if ((verify.rows?.[0]?.n ?? 0) < 3) {
    throw new Error('Drizzle migrations did not create required tables in public schema');
  }
  
  await client.end();
}


