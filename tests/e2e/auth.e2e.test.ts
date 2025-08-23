import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { buildTwoPersonHouse } from './helpers/test-scenarios';
import { cleanupTestData } from './helpers/reset-backend';

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
