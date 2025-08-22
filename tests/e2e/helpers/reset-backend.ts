import { dbFromEnv } from '../../../src/lib/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

// Remove backend rows for given emails; does not touch Supabase auth users
export async function resetBackendForEmails(emails: string[]): Promise<void> {
  const lower = emails.map(e => e.toLowerCase());
  const client = new pg.Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'chorely',
    connectionString: process.env.DATABASE_URL,
  } as any);
  await client.connect();
  try {
    // no transaction; ignore missing tables
    try { await client.query('DELETE FROM chore_approvals WHERE user_email = ANY($1)', [lower]); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM disputes WHERE disputer_email = ANY($1)', [lower]); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM user_homes WHERE user_email = ANY($1)', [lower]); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM users WHERE email = ANY($1)', [lower]); } catch (e: any) { if (e.code !== '42P01') throw e; }
  } finally {
    await client.end();
  }
}

// Comprehensive cleanup for all test data created during a test run
export async function cleanupTestData(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('cleanupTestData called outside of test environment. Skipping.');
    return;
  }

  console.log('[cleanup] Cleaning up all test data...');
  
  const client = new pg.Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'chorely',
    connectionString: process.env.DATABASE_URL,
  } as any);
  await client.connect();
  try {
    // Clean up in order of foreign key dependencies; ignore missing relations
    try { await client.query('DELETE FROM todo_items'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM chore_approvals'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM dispute_votes'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM disputes'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM chores'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM user_homes'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM users'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM home'); } catch (e: any) { if (e.code !== '42P01') throw e; }
    try { await client.query('DELETE FROM activities'); } catch (e: any) { if (e.code !== '42P01') throw e; }
  } finally {
    await client.end();
  }
  
  console.log('[cleanup] Test data cleanup complete.');
}


