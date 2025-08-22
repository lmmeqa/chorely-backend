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
        return new Response(buf, { headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400' } });
      } catch {
        return c.text('Not Found', 404);
      }
    });
  } catch { /* noop */ }
};

const app = new Hono();
app.use('*', cors());

app.get('/public/ping', (c) => c.json({ pong: true }));

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