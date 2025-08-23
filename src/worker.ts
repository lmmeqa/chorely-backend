import { Hono } from 'hono';
import { cors } from 'hono/cors';
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
import type { Bindings } from './lib/db';

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

app.use('*', cors());

app.get('/public/ping', (c) => c.json({ pong: true }));

// Add a tiny /internal/db-ping to verify from the app
app.get('/internal/db-ping', async (c) => {
  const db = (await import('./lib/db')).dbFromEnv(c.env as any);
  // @ts-ignore - drizzle has .execute
  const res = await (db as any).execute('select current_user, current_database()');
  return c.json({ ok: true, res });
});

// Add a debug endpoint to check completed chores
app.get('/internal/debug-chores', async (c) => {
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

// 500 handler
app.onError((err, c) => {
  console.error('[onError]', err);
  try { return c.json({ error: 'Internal Server Error', message: String((err as any)?.message || err) }, 500); }
  catch { return c.text('Internal Server Error', 500); }
});

export default app;