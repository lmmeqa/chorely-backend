import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './worker';
import type { Bindings } from './lib/db';

const port = Number(process.env.PORT) || 3000;
console.log(`[chorely] listening on http://0.0.0.0:${port}`);

// Inject env so routes/middleware read c.env.* in local dev
const bindings: Partial<Bindings> = {
  DATABASE_URL: process.env.DATABASE_URL!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
};

serve({
  port,
  fetch: (req) => app.fetch(req, bindings as any),
});