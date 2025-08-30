import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './lib/config';
import { usersRoutes } from './routes/users';
import { homesRoutes } from './routes/homes';
import { choresRoutes } from './routes/chores';
import { disputesRoutes } from './routes/disputes';
import { approvalsRoutes } from './routes/approvals';
import { pointsRoutes } from './routes/points';
import { activitiesRoutes } from './routes/activities';
import { todosRoutes } from './routes/todos';
import { disputeVotesRoutes } from './routes/dispute-votes';
import { logger } from './middleware/logger';
import { rateLimit } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import type { Bindings } from './lib/db';

// Utility helpers
const isProd = (env: any) => (env?.NODE_ENV ?? process.env.NODE_ENV) === 'production';

function getAllowedOrigins(env: any): string[] {
  const raw = (env?.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// Optional local static serving for /seed/* when running under Node (dev/tests)
const addLocalStatic = (app: any) => {
  try {
    const isNode = typeof process !== 'undefined' && !!(process as any).versions?.node;
    if (!isNode) return;
    app.get('/seed/*', async (c: any) => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const rel = c.req.path.replace(/^\/seed\//, '');
      const file = path.join(process.cwd(), 'static', 'seed', rel);
      try {
        const buf = await fs.readFile(file);
        const ct = file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream';
        return new Response(new Uint8Array(buf).buffer, {
          headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400' },
        });
      } catch {
        return c.text('Not Found', 404);
      }
    });
  } catch { /* noop */ }
};

const app = new Hono<{ Bindings: Bindings }>();

// Add environment to context middleware
app.use('*', async (c, next) => {
  // Make env available to all routes via c.env
  await next();
});

// Add comprehensive logging middleware
app.use('*', logger);

// Debug global error handler (removed to allow proper error handling in routes)

// Light rate limiting for public endpoints
app.use('*', rateLimit());



// Attach CORS using ALLOWED_ORIGINS list
app.use('*', (c, next) => {
  const origins = getAllowedOrigins(c.env);
  return cors({
    origin: (origin) => {
      if (!origin) return undefined; // disallow non-browser by default
      if (origins.includes('*')) return origin;
      return origins.includes(origin) ? origin : undefined;
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET','POST','PATCH','DELETE','OPTIONS'],
    credentials: true,
    maxAge: 86400,
  })(c, next);
});

app.get('/public/ping', (c) => c.json({ pong: true }));

// Internal/dev routes — gated to non-production
app.get('/internal/db-ping', async (c) => {
  if (isProd(c.env)) return c.text('Not Found', 404);
  const db = (await import('./lib/db')).dbFromEnv(c.env as any);
  // @ts-ignore - drizzle has .execute
  const res = await (db as any).execute('select current_user, current_database()');
  return c.json({ ok: true, res });
});

app.get('/internal/debug-chores', async (c) => {
  if (isProd(c.env)) return c.text('Not Found', 404);
  const db = (await import('./lib/db')).dbFromEnv(c.env as any);
  const { chores, homes } = await import('./db/schema');
  const { eq } = await import('drizzle-orm');
  
  // Get all homes and their chores
  const allHomes = await db.select().from(homes);
  const allChores = await db.select().from(chores);
  
  const homeStats = allHomes.map(home => {
    const homeChores = allChores.filter(c => c.homeId === home.id);
    const completedChores = homeChores.filter(c => c.status === 'complete');
    
    return {
      id: home.id,
      name: home.name,
      total: homeChores.length,
      completed: completedChores.length,
      completedChores: completedChores.map(c => ({
        uuid: c.uuid,
        name: c.name,
        status: c.status,
        completedAt: c.completedAt,
        userEmail: c.userEmail
      }))
    };
  });
  
  return c.json({ 
    homes: homeStats,
    totalChores: allChores.length,
    totalCompleted: allChores.filter(c => c.status === 'complete').length
  });
});

// Mount routes
app.route('/', usersRoutes);
app.route('/', homesRoutes);
app.route('/', choresRoutes);
app.route('/', disputesRoutes);
app.route('/', approvalsRoutes);
app.route('/', pointsRoutes);
app.route('/', activitiesRoutes);
app.route('/', todosRoutes);
app.route('/', disputeVotesRoutes);

// Enable local static after routes
addLocalStatic(app);

// Error handler
app.onError((err, c) => {
  return errorHandler(err, c);
});

export default app;