import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { verifySupabaseToken } from '../../src/middleware/supabaseAuth';

function fakeJwt(payload: object): string {
  const base64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64(payload)}.sig`;
}

describe('supabaseAuth middleware (extended)', () => {
  it('rejects malformed Authorization header', async () => {
    const app = express();
    app.get('/p', verifySupabaseToken, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/p').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });


  it('rejects empty Bearer token', async () => {
    const app = express();
    app.get('/p', verifySupabaseToken, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/p').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });
});


