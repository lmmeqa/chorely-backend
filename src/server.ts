import { serve } from '@hono/node-server';
import app from './worker';

const port = Number(process.env.PORT) || 3000;
console.log(`[chorely] listening on http://0.0.0.0:${port}`);
serve({ fetch: app.fetch, port });