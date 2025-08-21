import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context, Next } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

type Env = {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type Bindings = Env;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function getProjectJWKS(projectUrl: string) {
  let jwks = jwksCache.get(projectUrl);
  if (!jwks) {
    const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', projectUrl);
    jwks = createRemoteJWKSet(jwksUrl);
    jwksCache.set(projectUrl, jwks);
  }
  return jwks!;
}

async function requireUser(c: Context<{ Bindings: Bindings; Variables: { user?: any } }>, next: Next) {
  const hdr = c.req.header('authorization') || c.req.header('Authorization');
  if (!hdr?.startsWith('Bearer ')) return c.text('Missing Authorization', 401);
  const token = hdr.slice('Bearer '.length);
  try {
    const issuer = new URL('/auth/v1', c.env.SUPABASE_URL).toString();
    const { payload } = await jwtVerify(token, getProjectJWKS(c.env.SUPABASE_URL), { issuer });
    c.set('user', {
      id: payload.sub as string,
      email: (payload as any).email as string | undefined,
      role: (payload as any).role as string | undefined,
      claims: payload,
    });
    await next();
  } catch (_err) {
    return c.text('Invalid token', 401);
  }
}

function sql(c: Context<{ Bindings: Bindings; Variables: { user?: any } }>) {
  return neon(c.env.DATABASE_URL);
}

function supa(c: Context<{ Bindings: Bindings; Variables: { user?: any } }>) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
}

const app = new Hono<{ Bindings: Bindings; Variables: { user?: any } }>();
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your production domains
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
}));

app.get('/healthz', (c) => c.text('ok'));
app.get('/readyz', async (c) => { const db = sql(c); await db`select 1`; return c.text('ok'); });
app.get('/public/ping', (c) => c.json({ pong: true }));

app.get('/me', requireUser, async (c) => {
  const user = c.get('user')!;
  const db = sql(c);
  const rows = await db`select id, auth_user_id, email, created_at from users where auth_user_id = ${user.id} limit 1`;
  const profile = rows[0] ?? null;
  if (profile) return c.json({ user, profile });
  const created = await db`insert into users (auth_user_id, email) values (${user.id}::uuid, ${user.email ?? null}) returning id, auth_user_id, email, created_at`;
  return c.json({ user, profile: created[0] });
});

app.post('/upload', requireUser, async (c) => {
  const supabase = supa(c);
  const user = c.get('user')!;
  const blob = await c.req.blob();
  const ext = (blob.type?.split('/')?.[1] ?? 'bin').toLowerCase();
  const path = `users/${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('uploads').upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) return c.json({ error: error.message }, 400);
  const { data } = supabase.storage.from('uploads').getPublicUrl(path);
  return c.json({ url: data.publicUrl });
});

export default app;


