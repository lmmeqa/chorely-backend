import type { IncomingMessage, ServerResponse } from 'http';
import app from './worker';

// Node adapter for Hono app so Supertest can use it
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = `http://${req.headers.host || 'localhost'}${req.url || '/'}`;
  const method = req.method || 'GET';

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else headers.set(key, String(value));
  }

  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
  const body = hasBody ? (req as any) : undefined;
  const request = new Request(url, { method, headers, body: body as any, // @ts-expect-error undici streaming
    duplex: 'half' as any });

  const env = {
    DATABASE_URL: process.env.DATABASE_URL || '',
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  } as any;

  if (process.env.VITEST_SHOW_LOGS === 'true') {
    // Safe to print as per user instruction; for debugging
    // eslint-disable-next-line no-console
    console.log('[adapter env]', {
      DATABASE_URL: env.DATABASE_URL,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_JWT_SECRET: env.SUPABASE_JWT_SECRET,
      DB_HOST: env.DB_HOST,
      DB_PORT: env.DB_PORT,
      DB_USER: env.DB_USER,
      DB_NAME: env.DB_NAME,
    });
  }

  let response: Response;
  try {
    // eslint-disable-next-line no-console
    if (process.env.VITEST_SHOW_LOGS === 'true') console.log('[adapter] fetch', method, url);
    response = await (app as any).fetch(request, env, {});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[adapter] fetch error', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'adapter error', message: String((err as any)?.message || err) }));
    return;
  }

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) {
    const ab = await response.arrayBuffer();
    res.end(Buffer.from(ab));
  } else {
    res.end();
  }
}


