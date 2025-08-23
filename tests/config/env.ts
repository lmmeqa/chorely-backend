import path from 'path';
import dotenv from 'dotenv';

// Load main .env first, then tests/.env to override if needed
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });


// Track which keys fell back to defaults (we will only log keys, never values)
const defaulted: string[] = [];

// Sensible defaults for local Docker Postgres (host machine -> container port mapping)
if (!process.env.DB_HOST) { process.env.DB_HOST = 'localhost'; defaulted.push('DB_HOST'); }
if (!process.env.DB_PORT) { process.env.DB_PORT = '5433'; defaulted.push('DB_PORT'); }
if (!process.env.DB_USER) { process.env.DB_USER = 'postgres'; defaulted.push('DB_USER'); }
if (!process.env.DB_PASSWORD) { process.env.DB_PASSWORD = 'password'; defaulted.push('DB_PASSWORD'); }
if (!process.env.DB_NAME) { process.env.DB_NAME = 'chorely'; defaulted.push('DB_NAME'); }

// Supabase config defaults for local dev/testing
if (process.env.EXPO_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
}
if (!process.env.SUPABASE_URL) { process.env.SUPABASE_URL = 'http://localhost:54321'; defaulted.push('SUPABASE_URL'); }
if (process.env.SUPABASE_ANON_KEY && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}
if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) { process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key'; defaulted.push('EXPO_PUBLIC_SUPABASE_ANON_KEY'); }
if (!process.env.SUPABASE_JWT_SECRET) { process.env.SUPABASE_JWT_SECRET = 'devsecret'; defaulted.push('SUPABASE_JWT_SECRET'); }
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_dev'; defaulted.push('SUPABASE_SERVICE_ROLE_KEY'); }

// Emit a single clear alert if any defaults are being used
if (defaulted.length > 0) {
  const list = defaulted.join(', ');
  // Do not print actual values, only the keys
  console.warn(`[tests/config/env] Using default values for: ${list}. Define these in tests/.env to silence this message.`);
}


