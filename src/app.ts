// Minimal Node.js adapter for Hono app testing
import { serve } from '@hono/node-server';
import app from './worker';

// Mock server for supertest - just export the raw Hono app with a serve method
const mockServer = Object.assign(app, {
  // Supertest expects a listen method
  listen: (port: number, callback?: () => void) => {
    const server = serve({
      fetch: (req, env) => app.fetch(req, {
        DATABASE_URL: process.env.DATABASE_URL!,
        SUPABASE_URL: process.env.SUPABASE_URL!,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
        SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'uploads',
        SUPABASE_SIGNED_URL_TTL: process.env.SUPABASE_SIGNED_URL_TTL || '3600'
      }),
      port
    });
    if (callback) callback();
    return server;
  }
});

export default mockServer;