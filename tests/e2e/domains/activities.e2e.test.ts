import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

const agent = request(app);

async function json(method: string, url: string, body?: any, headers?: Record<string, string>) {
  let r: any = agent;
  const h = headers || {};
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  if (Object.keys(h).length > 0) r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try { return { status: res.status, json: JSON.parse(text) } as any; }
  catch { return { status: res.status, json: text } as any; }
}

describe('Activities E2E', () => {
  const scenario = buildTwoPersonHouse();
  const [alice, bob] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) {
      await createOrJoinUser(agent as any, u.email, u.name, homeId);
    }
  }, 30000);

  it('returns recent activity for home and various timeFrames', async () => {
    const tokenA = tokens[alice.email];
    for (const tf of ['1d','3d','7d','30d']) {
      const r = await json('GET', `/activities?homeId=${encodeURIComponent(homeId)}&timeFrame=${tf}`, undefined, { Authorization: `Bearer ${tokenA}` });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json));
    }
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


