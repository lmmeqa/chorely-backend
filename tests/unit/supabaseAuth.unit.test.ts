import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { verifySupabaseToken } from '../../src/middleware/supabaseAuth';

describe('supabaseAuth middleware (negative paths)', () => {
  it('rejects requests without authentication token', async () => {
    const app = express();
    app.get('/protected', verifySupabaseToken, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body?.error).toMatch(/Missing token/i);
  });

  it('rejects invalid tokens in production mode', async () => {
    const app = express();
    app.get('/protected', verifySupabaseToken, (_req, res) => res.json({ ok: true }));

    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer not-a-valid-token');

      expect(res.status).toBe(401);
      expect(res.body?.error).toMatch(/Invalid or expired token/i);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});


