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

const app = new Hono();
app.use('*', cors());

app.get('/public/ping', (c) => c.json({ pong: true }));

// Mount routes under root
app.route('/', usersRoutes);
app.route('/', homesRoutes);
app.route('/', choresRoutes);
app.route('/', disputesRoutes);
app.route('/', approvalsRoutes);
app.route('/', pointsRoutes);
app.route('/', activitiesRoutes);
app.route('/', todosRoutes);
app.route('/', disputeVotesRoutes);

// 500 handler
app.onError((err, c) => {
  console.error('[onError]', err);
  try { return c.json({ error: 'Internal Server Error', message: String((err as any)?.message || err) }, 500); }
  catch { return c.text('Internal Server Error', 500); }
});

export default app;