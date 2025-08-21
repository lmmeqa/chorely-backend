import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { buildTwoPersonHouse } from './helpers/test-scenarios';
import { cleanupTestData } from './helpers/reset-backend';

const agent = request(app);

// use shared helper

async function json(method: string, url: string, body?: any, headers?: Record<string, string>) {
  let r: any = agent;
  const h = { Connection: 'close', ...(headers || {}) } as Record<string, string>;
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    case 'PATCH': r = r.patch(url).send(body ?? {}); break;
    case 'DELETE': r = r.delete(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try {
    return { status: res.status, json: JSON.parse(text) } as any;
  } catch {
    return { status: res.status, json: text } as any;
  }
}

describe('Auth E2E', () => {
  const scenario = buildTwoPersonHouse();
  const email = scenario.users[0].email;
  const pw = scenario.users[0].password;
  let token = '';

  beforeAll(async () => {
    token = await supabaseSignupOrLogin(email, pw);
  }, 30000);

  it('POST /auth/authenticate syncs or creates user', async () => {
    const r = await json('POST', '/auth/authenticate', {}, { Authorization: `Bearer ${token}` });
    assert.equal(r.status, 200);
    assert.equal(r.json.email, email.toLowerCase());
  });

  it('GET /auth/me returns current user', async () => {
    const r = await json('GET', '/auth/me', undefined, { Authorization: `Bearer ${token}` });
    assert.equal(r.status, 200);
    assert.equal(r.json.email, email.toLowerCase());
  });

  it('GET /auth/me without token is 401', async () => {
    const r = await json('GET', '/auth/me');
    assert.equal(r.status, 401);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
